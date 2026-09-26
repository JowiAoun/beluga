// Ties the detector, label matching and the frame gate to a walk: the detector reads the small
// camera frames, the hazard engine asks it for labels, and the gate says when a frame is worth
// sending to triage. Until reporting and triage exist (Phases 5 and 9), the gate only counts what
// it would send, which is how the "4 to 6 calls on a 2-minute route" check is done.

import type { LabelFor } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { NETWORK } from "@/lib/shared/params";
import { cellOf } from "@/lib/shared/geo";
import type { SmallImage } from "@/lib/xr/cameraImage";
import type { SensingSession } from "@/lib/xr/session";
import type { SensingUpdate } from "@/lib/xr/types";
import { meanBrightness, type Detection } from "./detections";
import { Detector, type Delegate } from "./detector";
import { FrameGate, TurnMeter, type GateResult } from "./gate";
import { LabelMatcher } from "./match";
import type { WorkerReply, WorkerRequest } from "./messages";
import { findStrip, StripTracker, stripHazard, type StripSighting } from "./strip";

export type DetectorState = "loading" | "ready" | "failed";

export interface DetectStats {
  state: DetectorState;
  delegate: Delegate | null;
  // "worker" off the main thread, or "page" when the worker couldn't start.
  runsOn: "worker" | "page" | null;
  // Why the worker couldn't start, when the detector runs on the page instead.
  workerError: string | null;
  error: string | null;
  // Averages over recent frames.
  msPerFrame: number;
  framesPerSecond: number;
  brightness: number | null;
  detections: Detection[];
  // The yellow edge strip check: frames in a row that saw one, and the latest sighting.
  strip: { on: boolean; streak: number; last: StripSighting | null };
  gate: {
    // Frames the gate let through this session. They go to triage only with reporting on.
    sent: number;
    last: { reason: string; label: string; t: number } | null;
    lastSkip: { reason: string; trigger: string; t: number } | null;
  };
}

// Weight of the newest frame in the running averages.
const AVERAGE = 0.2;
// A strip seen in a frame older than this no longer warns: the camera frames have stopped.
const STRIP_STALE_MS = 1000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class DetectPipeline {
  // One of these runs the model: a worker, or the page itself as the fallback.
  private worker: Worker | null = null;
  private detector: Detector | null = null;
  private delegate: Delegate | null = null;
  // A frame is out for detection. New frames are dropped until it comes back, so results never lag.
  private busy = false;
  private state: DetectorState = "loading";
  private error: string | null = null;
  private workerError: string | null = null;
  private loading: Promise<void> | null = null;
  private readonly matcher = new LabelMatcher();
  private gate = new FrameGate();
  private readonly turn = new TurnMeter();
  private hfovDeg: number | null = null;
  private msPerFrame = 0;
  private framesPerSecond = 0;
  private lastFrameAt: number | null = null;
  private brightness: number | null = null;
  private detections: Detection[] = [];
  private sent = 0;
  private last: DetectStats["gate"]["last"] = null;
  private lastSkip: DetectStats["gate"]["lastSkip"] = null;
  private readonly strip = new StripTracker();
  private stripOn = true;
  private stripSince: number | null = null;
  private enabled = false;
  private enabledAt = 0;

  // Loading the model is allowed during setup; analysing camera frames is not.
  setEnabled(on: boolean, t: number): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.enabledAt = t;
    this.matcher.reset();
    this.detections = [];
    this.strip.reset();
    this.stripSince = null;
    this.lastFrameAt = null;
    this.brightness = null;
  }

  // Loads the model once, ahead of the first walk: in a worker, or on the page if that fails.
  // Safe to call again. `prefer` CPU skips the GPU, which ARCore and the camera also use.
  load(prefer: Delegate = "GPU"): Promise<void> {
    this.loading ??= this.loadWorker(prefer).then(async (inWorker) => {
      if (inWorker) return;
      try {
        this.detector = await Detector.create(false, prefer);
        this.delegate = this.detector.delegate;
        this.state = "ready";
      } catch (err) {
        this.state = "failed";
        this.error = errorText(err);
      }
    });
    return this.loading;
  }

  // Turns the detector off for this page, to compare the safety loop with and without it.
  disable(): void {
    this.loading ??= Promise.resolve();
    this.fail("turned off with ?detector=off");
  }

  private loadWorker(prefer: Delegate): Promise<boolean> {
    return new Promise((resolve) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./detector.worker.ts", import.meta.url), { type: "module" });
      } catch (err) {
        this.workerError = errorText(err);
        resolve(false);
        return;
      }
      worker.onerror = (event) => {
        this.workerError = event.message || "the worker failed to load";
        worker.terminate();
        if (this.worker === worker) this.fail("the detector worker stopped");
        resolve(false);
      };
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        const reply = event.data;
        if (reply.type === "ready") {
          this.worker = worker;
          this.delegate = reply.delegate;
          this.state = "ready";
          resolve(true);
        } else if (reply.type === "failed") {
          this.workerError = reply.error;
          worker.terminate();
          // Failing to load in the worker falls back to the page; failing later turns it off.
          if (this.worker === worker) this.fail(reply.error);
          resolve(false);
        } else {
          this.busy = false;
          this.accept(reply.detections, reply.t, reply.ms);
        }
      };
      this.post(worker, { type: "load", prefer });
    });
  }

  private post(worker: Worker, request: WorkerRequest, transfer: Transferable[] = []): void {
    worker.postMessage(request, transfer);
  }

  private fail(error: string): void {
    this.worker = null;
    this.detector = null;
    this.state = "failed";
    this.error = error;
    this.detections = [];
    this.busy = false;
  }

  // Starts reading a session's frames. Returns the function that stops it.
  attach(session: SensingSession): () => void {
    this.enabled = false;
    this.matcher.reset();
    this.turn.reset();
    this.gate = new FrameGate();
    this.sent = 0;
    this.last = null;
    this.lastSkip = null;
    this.detections = [];
    this.brightness = null;
    this.lastFrameAt = null;
    this.strip.reset();
    this.stripSince = null;
    const detach = session.onDetectorFrame((image, t) => this.onFrame(image, t));
    return () => { this.setEnabled(false, 0); detach(); };
  }

  // For the hazard engine. Labels need the view's width in degrees, so they wait for an update.
  labelFor(update: SensingUpdate): LabelFor | undefined {
    this.hfovDeg = update.fov.horizontal;
    if (this.state !== "ready") return undefined;
    const hfov = update.fov.horizontal;
    return (query) => this.matcher.labelFor(query, update.t, hfov);
  }

  // While a triage call is out, the gate holds every other frame back.
  setTriageInFlight(on: boolean): void {
    this.gate.setInFlight(on);
  }

  // Asks the frame gate about this update. `fix` rounds to a grid cell for the lasting cooldown.
  check(
    update: SensingUpdate,
    hazards: HazardUpdate[],
    fix: { lat: number; lon: number; accuracy: number } | null,
  ): GateResult {
    const cell = fix && fix.accuracy <= NETWORK.locationMaxAccuracyM ? cellOf(fix.lat, fix.lon) : null;
    const result = this.gate.update({
      t: update.t,
      hazards,
      stationary: update.stationary,
      turnRateDegPerS: this.turn.update(update.t, update.worldFromView),
      brightness: this.brightness,
      cell,
    });
    if (result.fire) {
      this.sent++;
      this.last = { reason: result.fire.reason, label: result.fire.hazard.label, t: update.t };
    }
    if (result.skipped) this.lastSkip = { reason: result.skipped.reason, trigger: result.skipped.trigger, t: update.t };
    return result;
  }

  // Turns the yellow edge strip check on or off (a setting). It reads the same small frames.
  setStrip(on: boolean): void {
    this.stripOn = on;
    if (!on) {
      this.strip.reset();
      this.stripSince = null;
    }
  }

  // The yellow strip as an "edge" hazard in this update's view, or null.
  stripFor(update: SensingUpdate) {
    const sighting = this.strip.active();
    if (!sighting || this.stripSince === null || this.lastFrameAt === null) return null;
    if (update.t - this.lastFrameAt > STRIP_STALE_MS) return null;
    return stripHazard(sighting, update, this.stripSince);
  }

  // The latest boxes, for the replay recorder. A new array each time the detector answers.
  latestDetections(): Detection[] {
    return this.detections;
  }

  stats(): DetectStats {
    return {
      state: this.state,
      delegate: this.delegate,
      runsOn: this.state !== "ready" ? null : this.worker ? "worker" : "page",
      workerError: this.workerError,
      error: this.error,
      msPerFrame: this.msPerFrame,
      framesPerSecond: this.framesPerSecond,
      brightness: this.brightness,
      detections: this.detections,
      strip: { on: this.stripOn, ...this.strip.stats() },
      gate: { sent: this.sent, last: this.last, lastSkip: this.lastSkip },
    };
  }

  private onFrame(image: SmallImage, t: number): void {
    if (!this.enabled) return;
    this.brightness = meanBrightness(image);
    // Colour only, so it runs here even when the detector is off or still loading.
    if (this.stripOn) {
      this.strip.update(findStrip(image));
      this.stripSince = this.strip.active() ? (this.stripSince ?? t) : null;
    }
    if (this.lastFrameAt !== null && t > this.lastFrameAt) {
      this.framesPerSecond += AVERAGE * (1000 / (t - this.lastFrameAt) - this.framesPerSecond);
    }
    this.lastFrameAt = t;
    const hfovDeg = this.hfovDeg;
    if (this.busy || hfovDeg === null || this.state !== "ready") return;
    if (this.worker) {
      // A copy goes to the worker: the debug preview still draws this frame after us.
      const data = image.data.slice();
      this.busy = true;
      this.post(this.worker, { type: "detect", image: { ...image, data }, hfovDeg, t }, [data.buffer]);
      return;
    }
    const detector = this.detector;
    if (!detector) return;
    this.busy = true;
    // Later, outside the AR frame callback, so the safety loop's update goes first.
    setTimeout(() => {
      if (!this.enabled || t < this.enabledAt) { this.busy = false; return; }
      const began = performance.now();
      try {
        this.accept(detector.detect(image, hfovDeg), t, performance.now() - began);
      } catch (err) {
        // A detector crash costs the labels, never the warnings.
        this.fail(errorText(err));
      }
      this.busy = false;
    }, 0);
  }

  private accept(detections: Detection[], t: number, ms: number): void {
    if (!this.enabled || t < this.enabledAt) return;
    this.detections = detections;
    this.msPerFrame += AVERAGE * (ms - this.msPerFrame);
    this.matcher.update(detections, t);
  }
}
