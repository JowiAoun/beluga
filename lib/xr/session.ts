// Runs the AR session and, about ten times a second, hands the app world points from depth,
// the phone's pose, the floor height and the walking direction. Nothing here uses the network.

import { DETECTOR, FRAMES, SENSING } from "@/lib/shared/params";
import { createCameraReader, encodeJpeg, fitLongEdge, type CameraReader, type SmallImage } from "./cameraImage";
import { gridFor, NO_DEPTH, sampleDepth, StaleDepth, type DepthSample } from "./depth";
import { meanBrightness } from "@/lib/detect/detections";
import { DarkCamera } from "./dark";
import { FloorTracker, type FloorEvent } from "./floor";
import { xrReady } from "./gl";
import { forwardOf, upOf } from "./geometry";
import { MotionTracker } from "./motion";
import { fieldOfView, type FieldOfView } from "./projection";
import { requestArSession, SESSION_LEVELS } from "./request";
import { TrackingMonitor } from "./tracking";
import type { FloorSource, SensingUpdate, Vec3 } from "./types";

// Voice lines the session asks for. The app decides how they sound.
export type Cue = "take_steps" | "calibrated" | "hold_steady" | "tap_camera" | "camera_dark" | "camera_light";

// stop: the Stop button. hidden: the app left the screen. error: something threw.
// ended: Chrome ended the session, for example on the back button.
export type EndReason = "stop" | "hidden" | "error" | "ended";

export interface Granted {
  depth: boolean;
  camera: boolean;
  hitTest: boolean;
  domOverlay: boolean;
  localFloor: boolean;
}

export interface LiveStats {
  frameRate: number;
  updateRate: number;
  processingMs: number;
  depthError: string | null;
  cameraError: string | null;
  // Depth has stopped changing while the phone moves, so it isn't used.
  depthFrozen: boolean;
}

// Which setup the phone took: an AR level from lib/xr/request.ts, or "camera mode".
export interface SessionSetup {
  name: string;
  // Setups the phone refused first, with Chrome's reason.
  refused: string[];
}

export interface SessionSummary {
  reason: EndReason;
  error: string | null;
  setup: string | null;
  durationS: number;
  granted: Granted | null;
  frameRate: number;
  // Updates per second while tracking.
  updateRate: number;
  trackingLostShare: number;
  depthValidShare: number | null;
  // Share of depth cells left out because their readings didn't agree.
  depthUnsteadyShare?: number | null;
  // Seconds of stale depth, left out because it stopped changing while the phone moved.
  depthFrozenS?: number;
  // Seconds with the camera covered or pitch dark.
  darkS?: number;
  fov: FieldOfView | null;
  floor: {
    source: FloorSource;
    calibratedAfterS: number | null;
    // Highest minus lowest floor height after calibration. The Phase 1 target is ±0.1 m, so 0.2 m at most.
    driftM: number | null;
    phoneAboveFloorM: number | null;
    // Times the floor moved to a new height (stairs, or ARCore shifting its world).
    moves?: number;
  };
}

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
}

export type DetectorSink = (image: SmallImage, t: number) => void;

export interface SensingOptions {
  // The DOM overlay's root. It must already be in the page.
  overlayRoot: Element;
  // A WebGL 2 context created with xrCompatible: true.
  gl: WebGL2RenderingContext;
  onUpdate: (update: SensingUpdate) => void;
  onCue: (cue: Cue) => void;
  // Called once when a session that started has ended, for any reason.
  onEnd: (summary: SessionSummary) => void;
}

export interface SensingSession {
  // What Chrome granted, once frames run. Rejects when the session could not start.
  ready: Promise<Granted>;
  stop(): void;
  // A JPEG of the view for Gemini, from the next frame. Null without camera access.
  captureFrame(longEdge?: number, quality?: number): Promise<CapturedFrame | null>;
  // Small frames for the detector, DETECTOR.ratePerSecond at most. Returns a function that stops them.
  onDetectorFrame(sink: DetectorSink): () => void;
  stats(): LiveStats;
  // Null until the session has started.
  setup(): SessionSetup | null;
  // Calibrates the floor again from the next update, when the user asks. Never called by itself.
  recalibrate(): void;
}

// The spec makes these getters throw when depth sensing wasn't granted.
function depthGranted(session: XRSession): boolean {
  try {
    return Boolean(session.depthUsage && session.depthDataFormat);
  } catch {
    return false;
  }
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

interface PendingCapture {
  longEdge: number;
  quality: number;
  at: number;
  resolve: (frame: CapturedFrame | null) => void;
}

// Call straight from the start tap. requestSession runs first, with nothing awaited before it,
// or Chrome drops the user gesture. A phone that refuses a setup gets the next one down.
export function startSensing(options: SensingOptions): SensingSession {
  const request = navigator.xr
    ? requestArSession(navigator.xr, options.overlayRoot)
    : Promise.reject(new Error("WebXR is missing: use Chrome on an ARCore phone"));

  const { onUpdate, onCue, onEnd } = options;
  // Replaced by a new context if this one was lost before the session started.
  let gl = options.gl;
  const interval = 1000 / SENSING.updatesPerSecond;
  const tracking = new TrackingMonitor();
  const motion = new MotionTracker();
  const detectorSinks = new Set<DetectorSink>();
  const captures: PendingCapture[] = [];

  let session: XRSession | null = null;
  let granted: Granted | null = null;
  let setup: SessionSetup | null = null;
  let endReason: EndReason | null = null;
  let endError: string | null = null;
  let over = false;
  let reader: CameraReader | null = null;
  let binding: XRWebGLBinding | null = null;
  let hitSource: XRHitTestSource | null = null;
  let floor: FloorTracker | null = null;
  let last: SensingUpdate | null = null;
  let startedAt = performance.now();
  let lastUpdateT = -Infinity;
  let lastDetectorT = -Infinity;
  // ARCore takes a moment to start tracking. That is not a loss, so the monitor waits for the first pose.
  let everTracked = false;

  const live: LiveStats = {
    frameRate: 0,
    updateRate: 0,
    processingMs: 0,
    depthError: null,
    cameraError: null,
    depthFrozen: false,
  };
  let windowStart = startedAt;
  let windowFrames = 0;
  let windowUpdates = 0;

  // Totals for the summary.
  let frames = 0;
  let lostFrames = 0;
  let trackedUpdates = 0;
  let trackedMs = 0;
  let lastTrackedT: number | null = null;
  let validShareSum = 0;
  let unsteadyShareSum = 0;
  const staleDepth = new StaleDepth();
  let frozenUpdates = 0;
  const darkCamera = new DarkCamera();
  let darkUpdates = 0;
  let depthUpdates = 0;
  let calibratedAt: number | null = null;
  let floorMin = Infinity;
  let floorMax = -Infinity;
  let aboveFloorSum = 0;
  let aboveFloorCount = 0;

  function end(reason: EndReason, error?: string) {
    if (endReason) return;
    endReason = reason;
    endError = error ?? null;
    if (session) void session.end().catch(() => {});
  }

  function resolveCaptures(now: number, all: boolean) {
    for (let i = captures.length - 1; i >= 0; i--) {
      if (all || now - captures[i].at > FRAMES.captureWaitMs) captures.splice(i, 1)[0].resolve(null);
    }
  }

  function emit(update: SensingUpdate) {
    last = update;
    windowUpdates++;
    onUpdate(update);
  }

  function countFrame(now: number) {
    frames++;
    windowFrames++;
    if (now - windowStart < 1000) return;
    const seconds = (now - windowStart) / 1000;
    live.frameRate = windowFrames / seconds;
    live.updateRate = windowUpdates / seconds;
    windowStart = now;
    windowFrames = 0;
    windowUpdates = 0;
  }

  // Camera reads happen on any frame, so a requested frame never waits for the next update.
  function readCamera(view: XRView, t: number) {
    const wantDetector = detectorSinks.size > 0 && t - lastDetectorT >= 1000 / DETECTOR.ratePerSecond;
    if (!wantDetector && captures.length === 0) return;
    if (!binding || !reader || !view.camera) return;
    const texture = binding.getCameraImage(view.camera);
    if (!texture) return;
    const { width, height } = view.camera;

    if (wantDetector) {
      lastDetectorT = t;
      const size = fitLongEdge(width, height, Math.max(DETECTOR.inputWidth, DETECTOR.inputHeight));
      const image = reader.read(texture, size.width, size.height);
      // The same small frame tells a covered or pitch-dark camera.
      const change = darkCamera.update(t, meanBrightness(image));
      if (change) onCue(change === "dark" ? "camera_dark" : "camera_light");
      for (const sink of detectorSinks) sink(image, t);
    }
    for (const capture of captures.splice(0)) {
      const size = fitLongEdge(width, height, capture.longEdge);
      const image = reader.read(texture, size.width, size.height);
      encodeJpeg(image, capture.quality).then(
        (blob) => capture.resolve({ blob, ...size }),
        () => capture.resolve(null),
      );
    }
  }

  function step(frame: XRFrame, refSpace: XRReferenceSpace, features: Granted) {
    const now = performance.now();
    const t = now - startedAt;
    countFrame(now);
    resolveCaptures(now, false);

    // Chrome returns null here, not undefined, until ARCore is tracking.
    const pose = frame.getViewerPose(refSpace) ?? null;
    const poseOk = pose !== null && !pose.emulatedPosition;
    everTracked ||= poseOk;
    if (everTracked) {
      const { change, cue } = tracking.update(t, poseOk);
      if (change === "lost") {
        motion.reset();
        if (cue) onCue("hold_steady");
      }
    }
    if (tracking.lost) lostFrames++;

    if (!pose || !poseOk) {
      // While lost, updates keep coming with no points, so the hazard engine knows to hold.
      if (tracking.lost && last && t - lastUpdateT >= interval * 0.9) {
        lastUpdateT = t;
        emit({ ...last, t, tracking: false, points: NO_DEPTH.points, sampleCount: 0, validCount: 0, unsteadyCount: 0 });
      }
      return;
    }

    const view = pose.views[0];
    const position = view.transform.position;
    const camera: Vec3 = { x: position.x, y: position.y, z: position.z };
    floor ??= new FloorTracker(features.localFloor ? 0 : camera.y - SENSING.localFloorGuessM);

    if (hitSource && !floor.calibrated) {
      const hit = frame.getHitTestResults(hitSource)[0]?.getPose(refSpace);
      if (hit && upOf(hit.transform.orientation) >= SENSING.floorHitMinUp) {
        floor.addHit(hit.transform.position.y, camera.y);
      }
    }

    try {
      readCamera(view, t);
    } catch (err) {
      // A camera failure costs the detector and Gemini their frames, never the warnings.
      live.cameraError = errorText(err);
      reader?.dispose();
      reader = null;
      binding = null;
      resolveCaptures(now, true);
    }

    // About 10 updates a second at 30 or 60 frames a second.
    if (t - lastUpdateT < interval * 0.9) return;
    if (lastTrackedT !== null) trackedMs += Math.min(t - lastTrackedT, SENSING.trackingLostMs);
    lastUpdateT = t;
    lastTrackedT = t;

    const projection = view.projectionMatrix;
    const worldFromView = view.transform.matrix;
    const fov = fieldOfView(projection);
    // Depth from a covered or pitch-dark camera is noise: none of it is used until the camera sees.
    const dark = darkCamera.dark;
    if (dark) darkUpdates++;
    let depth: DepthSample = NO_DEPTH;
    if (features.depth && !dark) {
      try {
        const info = frame.getDepthInformation(view);
        // Depth that needn't match the view comes with its own camera; otherwise it is the view's.
        if (info) {
          const place = info.projectionMatrix && info.transform ? info : null;
          depth = sampleDepth(
            info,
            place?.projectionMatrix ?? projection,
            place?.transform?.matrix ?? worldFromView,
            gridFor(fov),
          );
        }
        live.depthError = null;
      } catch (err) {
        live.depthError = errorText(err);
      }
      live.depthFrozen = staleDepth.update(t, depth, camera, forwardOf(worldFromView));
      if (live.depthFrozen) {
        depth = NO_DEPTH;
        frozenUpdates++;
      }
    }

    const moving = motion.update(t, camera, forwardOf(worldFromView));
    let floorEvent: FloorEvent | null = null;
    if (features.depth && !dark) floorEvent = floor.update(t, depth.points, camera, moving.forward, moving.right);
    if (floorEvent === "calibration_started") onCue("take_steps");
    if (floorEvent === "calibrated") {
      calibratedAt = t;
      onCue("calibrated");
    }
    if (hitSource && floor.calibrated) {
      // The hit test's one job was the floor value before calibration.
      try {
        hitSource.cancel();
      } catch {
        // Already gone.
      }
      hitSource = null;
    }

    trackedUpdates++;
    if (depth.sampleCount > 0) {
      validShareSum += depth.validCount / depth.sampleCount;
      unsteadyShareSum += depth.unsteadyCount / depth.sampleCount;
      depthUpdates++;
    }
    if (floor.calibrated) {
      floorMin = Math.min(floorMin, floor.y);
      floorMax = Math.max(floorMax, floor.y);
      aboveFloorSum += camera.y - floor.y;
      aboveFloorCount++;
    }

    emit({
      t,
      // Dark counts as lost tracking downstream, so every warning holds still and goes quiet.
      tracking: !dark,
      dark,
      points: depth.points,
      sampleCount: depth.sampleCount,
      validCount: depth.validCount,
      unsteadyCount: depth.unsteadyCount,
      camera,
      // Copies: Chrome may reuse these arrays after the frame.
      worldFromView: Float32Array.from(worldFromView),
      viewFromWorld: Float32Array.from(view.transform.inverse.matrix),
      projection: Float32Array.from(projection),
      fov,
      floorY: floor.y,
      floorSource: floor.source,
      calibrating: floor.calibrating,
      floorDoubtful: floor.doubtful,
      forward: moving.forward,
      right: moving.right,
      speed: moving.speed,
      stationary: moving.stationary,
    });
    live.processingMs = performance.now() - now;
  }

  function summary(): SessionSummary {
    const durationS = (performance.now() - startedAt) / 1000;
    return {
      reason: endReason ?? "ended",
      error: endError,
      setup: setup?.name ?? null,
      durationS,
      granted,
      frameRate: durationS > 0 ? frames / durationS : 0,
      updateRate: trackedMs > 0 ? ((trackedUpdates - 1) * 1000) / trackedMs : 0,
      trackingLostShare: frames > 0 ? lostFrames / frames : 0,
      depthValidShare: depthUpdates > 0 ? validShareSum / depthUpdates : null,
      depthUnsteadyShare: depthUpdates > 0 ? unsteadyShareSum / depthUpdates : null,
      depthFrozenS: frozenUpdates / SENSING.updatesPerSecond,
      darkS: darkUpdates / SENSING.updatesPerSecond,
      fov: last?.fov ?? null,
      floor: {
        source: floor?.source ?? "guess",
        calibratedAfterS: calibratedAt === null ? null : calibratedAt / 1000,
        driftM: floorMax >= floorMin ? floorMax - floorMin : null,
        phoneAboveFloorM: aboveFloorCount > 0 ? aboveFloorSum / aboveFloorCount : null,
        moves: floor?.moves ?? 0,
      },
    };
  }

  function onSessionEnd() {
    over = true;
    try {
      hitSource?.cancel();
    } catch {
      // Already gone with the session.
    }
    hitSource = null;
    reader?.dispose();
    reader = null;
    binding = null;
    detectorSinks.clear();
    resolveCaptures(performance.now(), true);
    onEnd(summary());
  }

  async function attach(s: XRSession): Promise<Granted> {
    session = s;
    s.addEventListener("end", onSessionEnd, { once: true });
    // The session's own visibility, not the page's: the page may count as hidden while AR runs.
    s.addEventListener("visibilitychange", () => {
      if (s.visibilityState === "hidden") end("hidden");
    });

    try {
      if (endReason) throw new Error("Stopped before the session started");
      gl = await xrReady(gl);
      const baseLayer = new XRWebGLLayer(s, gl, { alpha: true, antialias: false, depth: false });
      s.updateRenderState({ baseLayer });

      let localFloor = true;
      let refSpace: XRReferenceSpace;
      try {
        refSpace = await s.requestReferenceSpace("local-floor");
      } catch {
        localFloor = false;
        refSpace = await s.requestReferenceSpace("local");
      }

      const listed = s.enabledFeatures;
      const has = (feature: string) => (listed ? listed.includes(feature) : undefined);

      if (has("hit-test") !== false && s.requestHitTestSource) {
        try {
          const viewer = await s.requestReferenceSpace("viewer");
          const down = (SENSING.floorHitRayDownDeg * Math.PI) / 180;
          const offsetRay = new XRRay(
            { x: 0, y: 0, z: 0, w: 1 },
            { x: 0, y: -Math.sin(down), z: -Math.cos(down), w: 0 },
          );
          hitSource = (await s.requestHitTestSource({ space: viewer, offsetRay })) ?? null;
        } catch {
          hitSource = null;
        }
      }

      if (has("camera-access") !== false && typeof XRWebGLBinding !== "undefined") {
        try {
          binding = new XRWebGLBinding(s, gl);
          reader = createCameraReader(gl);
        } catch {
          binding = null;
          reader = null;
        }
      }

      const features: Granted = {
        depth: has("depth-sensing") ?? depthGranted(s),
        camera: reader !== null,
        hitTest: hitSource !== null,
        // Chrome drops an optional DOM overlay without an error.
        domOverlay: Boolean(s.domOverlayState?.type),
        localFloor,
      };
      granted = features;

      startedAt = performance.now();
      windowStart = startedAt;
      const loop: XRFrameRequestCallback = (_time, frame) => {
        if (over) return;
        s.requestAnimationFrame(loop);
        gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        try {
          step(frame, refSpace, features);
        } catch (err) {
          end("error", errorText(err));
        }
      };
      s.requestAnimationFrame(loop);
      return features;
    } catch (err) {
      end("error", errorText(err));
      // end() does nothing when Stop came first, and this session still has to close.
      void s.end().catch(() => {});
      throw err;
    }
  }

  const ready = request.then(
    ({ session: s, level, refused }) => {
      setup = { name: SESSION_LEVELS[level].name, refused };
      return attach(s);
    },
    (err: unknown) => {
      resolveCaptures(performance.now(), true);
      throw err;
    },
  );

  return {
    ready,
    stop: () => end("stop"),
    captureFrame(longEdge = FRAMES.captureLongEdgePx, quality = FRAMES.captureJpegQuality) {
      if (over || granted?.camera === false) return Promise.resolve(null);
      return new Promise((resolve) => captures.push({ longEdge, quality, at: performance.now(), resolve }));
    },
    onDetectorFrame(sink) {
      detectorSinks.add(sink);
      return () => detectorSinks.delete(sink);
    },
    stats: () => ({ ...live }),
    setup: () => setup,
    recalibrate: () => floor?.recalibrate(),
  };
}
