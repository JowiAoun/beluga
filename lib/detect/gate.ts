// Decides, sparingly, when a camera frame is worth sending to the triage agent. Pure logic: the
// walk page asks it once per sensing update, then does the capture and the call itself.

import { lateralOf, sideOf } from "@/lib/audio/placement";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass } from "@/lib/shared/enums";
import { GATE } from "@/lib/shared/params";
import { forwardOf } from "@/lib/xr/geometry";

export type TriggerReason = "drop_off" | "head_height" | "new_thing" | "lasting";
export type SkipReason = "never_reported" | "in_flight" | "budget" | "turning" | "no_camera" | "dark";

export interface GateInput {
  // Milliseconds since the session started.
  t: number;
  // Active hazards, most urgent first.
  hazards: HazardUpdate[];
  stationary: boolean;
  // How fast the camera turns, degrees per second.
  turnRateDegPerS: number;
  // Mean brightness of the latest small frame, 0 to 255, or null without camera frames.
  brightness: number | null;
  // Grid cell of the current location, or null without a fix.
  cell: string | null;
}

export interface GateResult {
  fire: { reason: TriggerReason; hazard: HazardUpdate } | null;
  // A trigger that was due but held back, and why.
  skipped: { reason: SkipReason; trigger: TriggerReason; hazard: HazardUpdate } | null;
}

// Never a civic report, so never worth a frame.
const NEVER_REPORTED: ReadonlySet<DetectorClass> = new Set(["person", "car", "bus", "truck"]);

const HOUR_MS = 60 * 60 * 1000;

interface Seen {
  activeSince: number;
  // Its angle off the walking line when it first came within 2 m, to spot the user steering around it.
  nearAngle: number | null;
  done: Set<TriggerReason>;
}

export class FrameGate {
  private seen = new Map<string, Seen>();
  private cooldownUntil = new Map<string, number>();
  private sent: number[] = [];
  private inFlight = false;

  // Set while a triage call is out, so a second one never starts.
  setInFlight(inFlight: boolean): void {
    this.inFlight = inFlight;
  }

  update(input: GateInput): GateResult {
    const { t } = input;
    const present = new Set<string>();
    for (const hazard of input.hazards) {
      present.add(hazard.id);
      let seen = this.seen.get(hazard.id);
      if (!seen) {
        seen = { activeSince: t, nearAngle: null, done: new Set() };
        this.seen.set(hazard.id, seen);
      }
      if (seen.nearAngle === null && hazard.distance < GATE.steerAroundMaxDistanceM)
        seen.nearAngle = Math.abs(hazard.angle);
    }
    for (const id of this.seen.keys()) if (!present.has(id)) this.seen.delete(id);
    while (this.sent.length > 0 && t - this.sent[0] > HOUR_MS) this.sent.shift();

    for (const hazard of input.hazards) {
      const seen = this.seen.get(hazard.id)!;
      for (const reason of this.due(hazard, seen, input)) {
        const key = cooldownKey(reason, hazard, input.cell);
        if ((this.cooldownUntil.get(key) ?? -Infinity) > t) continue;
        const skip = this.skipFor(hazard, input);
        if (skip) {
          // Labels don't change back, so a person is only looked at once.
          if (skip === "never_reported") seen.done.add(reason);
          return { fire: null, skipped: { reason: skip, trigger: reason, hazard } };
        }
        seen.done.add(reason);
        this.cooldownUntil.set(key, t + cooldownMs(reason));
        this.sent.push(t);
        return { fire: { reason, hazard }, skipped: null };
      }
    }
    return { fire: null, skipped: null };
  }

  // Triggers this hazard meets now and hasn't fired yet.
  private due(hazard: HazardUpdate, seen: Seen, input: GateInput): TriggerReason[] {
    const reasons: TriggerReason[] = [];
    if (hazard.kind === "drop_off") reasons.push("drop_off");
    if (hazard.kind === "head_height" && hazard.distance < GATE.headHeightTriggerM) reasons.push("head_height");
    if (hazard.kind === "obstacle") {
      if (input.t - seen.activeSince >= GATE.newThingActiveMs) reasons.push("new_thing");
      const steeredAround =
        seen.nearAngle !== null &&
        hazard.distance < GATE.steerAroundMaxDistanceM &&
        Math.abs(hazard.angle) - seen.nearAngle > GATE.steerAroundAngleDeg;
      if (input.stationary || steeredAround) reasons.push("lasting");
    }
    return reasons.filter((r) => !seen.done.has(r));
  }

  private skipFor(hazard: HazardUpdate, input: GateInput): SkipReason | null {
    if (NEVER_REPORTED.has(hazard.label)) return "never_reported";
    if (this.inFlight) return "in_flight";
    const last = this.sent.at(-1);
    if (last !== undefined && input.t - last < GATE.phoneMinIntervalMs) return "budget";
    if (this.sent.length >= GATE.phoneHourlyBudget) return "budget";
    if (input.turnRateDegPerS > GATE.maxTurnRateDegPerS) return "turning";
    if (input.brightness === null) return "no_camera";
    if (input.brightness < GATE.minBrightness) return "dark";
    return null;
  }
}

function cooldownKey(reason: TriggerReason, hazard: HazardUpdate, cell: string | null): string {
  if (reason === "new_thing") return `new_thing:${hazard.label}:${sideOf(lateralOf(hazard))}`;
  if (reason === "lasting") return `lasting:${cell ?? "no_fix"}`;
  return reason;
}

function cooldownMs(reason: TriggerReason): number {
  if (reason === "new_thing") return GATE.newThingCooldownMs;
  if (reason === "lasting") return GATE.lastingCooldownMs;
  if (reason === "drop_off") return GATE.dropOffCooldownMs;
  return GATE.headHeightCooldownMs;
}

// How fast the camera turns left or right, from one update to the next.
export class TurnMeter {
  private last: { t: number; yaw: number } | null = null;

  update(t: number, worldFromView: Float32Array): number {
    const f = forwardOf(worldFromView);
    const yaw = (Math.atan2(f.x, -f.z) * 180) / Math.PI;
    const last = this.last;
    this.last = { t, yaw };
    if (!last || t <= last.t) return 0;
    const turned = ((((yaw - last.yaw) % 360) + 540) % 360) - 180;
    return Math.abs(turned) / ((t - last.t) / 1000);
  }

  reset(): void {
    this.last = null;
  }
}
