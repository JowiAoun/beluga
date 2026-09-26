// Reporting on the phone, only while the user has turned it on: hazard events go to the queue,
// the frame gate's picks go to triage, and a triage "report" becomes a civic report event.
// Off, nothing here sends anything.

import { civicReport, fromHazardEvent, type Where } from "@/lib/events/build";
import { deviceKey, newDeviceKey, reportingOn, setReporting } from "@/lib/events/consent";
import { EventQueue, type QueueStats } from "@/lib/events/queue";
import type { HazardEvent } from "@/lib/hazard/engine";
import type { GateResult } from "@/lib/detect/gate";
import { TriageResponseSchema, type TriageRequest, type TriageResponse } from "@/lib/shared/contracts";
import type { CivicCategory, SceneContext } from "@/lib/shared/enums";
import { cellOf } from "@/lib/shared/geo";
import { GATE, NETWORK } from "@/lib/shared/params";
import { stationById, type StationId } from "@/lib/shared/stations";
import type { SensingSession } from "@/lib/xr/session";
import { toBase64 } from "./ask";
import type { Fix } from "./location";

type Fire = NonNullable<GateResult["fire"]>;

// These categories switch a wide hazard's sound to the "blocked" taps.
const BLOCKING_CATEGORIES: ReadonlySet<CivicCategory> = new Set(["sidewalk_obstruction", "construction_barrier"]);

export interface TriageLog {
  ms: number;
  outcome: string;
  category: CivicCategory | null;
  report: boolean;
}

export interface ReportingStats {
  on: boolean;
  queue: QueueStats;
  lastTriage: TriageLog | null;
  sceneHint: SceneContext | null;
}

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export class Reporting {
  private readonly queue = new EventQueue(storage());
  private on = reportingOn();
  private key = deviceKey();
  private lastTriage: TriageLog | null = null;
  private triaging = false;
  // What triage last said the scene is. It picks words and goes with the next triage call.
  sceneHint: SceneContext | null = null;
  // Hazards triage said block the path: they play the "blocked" taps.
  readonly blocked = new Set<string>();
  // This session's reports, by category and cell, for the 15-minute repeat rule.
  private reported = new Map<string, number>();
  // The station picked in settings, and the last good fix of this walk, for when the fix goes bad.
  private station: StationId | "street" = "street";
  private lastGood: Where | null = null;

  setStation(station: StationId | "street"): void {
    this.station = station;
  }

  // A fresh fix within 100 m; else the last good one this walk (underground the fix goes bad);
  // else the chosen station's position (indoors with no fix at all). An event without a place is
  // refused by the backend, so with none of these nothing is queued.
  private where(fix: Fix | null): Where | null {
    const station = this.station === "street" ? null : stationById(this.station);
    const fresh =
      fix && fix.accuracy <= NETWORK.locationMaxAccuracyM && Date.now() - fix.at <= NETWORK.locationFixTimeoutMs;
    if (fresh) {
      this.lastGood = { lat: fix.lat, lon: fix.lon };
      return this.lastGood;
    }
    if (this.lastGood) return { ...this.lastGood, stationId: station?.id ?? null };
    return station ? { lat: station.lat, lon: station.lon, stationId: station.id } : null;
  }

  isOn(): boolean {
    return this.on;
  }

  setOn(on: boolean): void {
    this.on = on;
    setReporting(on);
    if (on) this.queue.start();
    else this.queue.stop();
  }

  newReporter(): void {
    this.key = newDeviceKey();
  }

  start(): void {
    this.sceneHint = null;
    this.blocked.clear();
    this.lastGood = null;
    if (this.on) this.queue.start();
  }

  stop(): void {
    // One last try, then the rest waits in storage for the next walk.
    if (this.on) void this.queue.flush();
    this.queue.stop();
  }

  // Near-misses and new hazards, queued only with reporting on and a place to put them.
  record(events: HazardEvent[], fix: Fix | null): void {
    if (!this.on || events.length === 0) return;
    const where = this.where(fix);
    if (!where) return;
    for (const event of events) this.queue.add(fromHazardEvent(event, where, this.key, this.sceneHint));
  }

  // Sends the gate's pick to triage. `onReported` plays the "reported" sound.
  async triage(
    fire: Fire,
    session: SensingSession,
    fix: Fix | null,
    setInFlight: (on: boolean) => void,
    onReported: () => void,
  ) {
    if (!this.on || this.triaging || !navigator.onLine) return;
    const where = this.where(fix);
    if (!where) {
      this.lastTriage = { ms: 0, outcome: "no location fix", category: null, report: false };
      return;
    }
    this.triaging = true;
    setInFlight(true);
    const began = performance.now();
    try {
      const frame = await session.captureFrame();
      if (!frame) {
        this.lastTriage = { ms: 0, outcome: "no frame", category: null, report: false };
        return;
      }
      const cell = cellOf(where.lat, where.lon);
      const { hazard } = fire;
      const request: TriageRequest = {
        frame: await toBase64(frame.blob),
        hazard: {
          kind: hazard.kind,
          distance: Math.min(10, hazard.distance),
          angle: hazard.angle,
          heightBand: null,
          blocking: hazard.blocking,
          detectorClass: hazard.label,
        },
        cell,
        sceneHint: this.sceneHint,
        deviceKey: this.key,
      };
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(NETWORK.triageTimeoutMs + 2000),
      }).catch(() => null);
      const parsed = TriageResponseSchema.safeParse(await response?.json().catch(() => null));
      const ms = Math.round(performance.now() - began);
      if (!parsed.success) {
        this.lastTriage = {
          ms,
          outcome: response ? `failed (${response.status})` : "offline",
          category: null,
          report: false,
        };
        return;
      }
      this.use(parsed.data, fire, where, cell, onReported);
      const result = parsed.data;
      this.lastTriage = {
        ms,
        outcome: result.report ? "reported" : "not reported",
        category: result.category,
        report: result.report,
      };
    } finally {
      this.triaging = false;
      setInFlight(false);
    }
  }

  private use(result: TriageResponse, fire: Fire, where: Where, cell: string, onReported: () => void): void {
    this.sceneHint = result.context;
    const { hazard } = fire;
    if (result.category && BLOCKING_CATEGORIES.has(result.category) && hazard.blocking > GATE.blockedSoundMinBlocking) {
      this.blocked.add(hazard.id);
    }
    if (!result.report || !result.category) return;
    const key = `${result.category}:${cell}`;
    const last = this.reported.get(key);
    const now = Date.now();
    if (last !== undefined && now - last < NETWORK.reportDedupMs) return;
    const event = civicReport(hazard, result, where, this.key);
    if (!event) return;
    this.reported.set(key, now);
    this.queue.add(event);
    onReported();
  }

  stats(): ReportingStats {
    return { on: this.on, queue: this.queue.stats(), lastTriage: this.lastTriage, sceneHint: this.sceneHint };
  }
}
