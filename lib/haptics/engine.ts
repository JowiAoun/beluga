// Local-only tactile warnings. Timing is adjustable; browsers do not expose motor amplitude.
import { priorityOf } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { defaultWarnFromM, HAPTICS } from "@/lib/shared/params";

export type VibrationStrength = keyof typeof HAPTICS.pulseMs;
export type VibrationKind = "obstacle" | "head_height" | "drop_off" | "calibrated";
export interface VibrationSettings { vibrationOn: boolean; vibrationStrength: VibrationStrength }
export type Vibrator = (pattern: number | number[]) => boolean;

export function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export const deviceVibrate: Vibrator = (pattern) => {
  if (!supportsVibration()) return false;
  if (typeof document !== "undefined" && document.hidden && pattern !== 0) return false;
  try { return navigator.vibrate(pattern); } catch { return false; }
};

export function vibrationPattern(kind: VibrationKind, strength: VibrationStrength): number[] {
  const pulse = HAPTICS.pulseMs[strength];
  if (kind === "calibrated") return [Math.min(pulse, HAPTICS.calibrationPulseMs), HAPTICS.calibrationGapMs, Math.min(pulse, HAPTICS.calibrationPulseMs)];
  if (kind === "drop_off") return [pulse, HAPTICS.pulseGapMs, pulse, HAPTICS.pulseGapMs, pulse];
  if (kind === "head_height") return [pulse, HAPTICS.pulseGapMs, pulse];
  return [pulse];
}

// How far away a hazard starts to warn, in metres: the same distance its sound uses.
export type WarnFrom = (hazard: HazardUpdate) => number;

export class HapticEngine {
  private warnFrom: WarnFrom = (hazard) => defaultWarnFromM(hazard.kind);
  private nextAt = 0;
  private currentPriority = Infinity;
  private vibrating = false;
  private calibrationUntil = 0;
  constructor(private settings: VibrationSettings, private readonly vibrate: Vibrator = deviceVibrate) {}

  configure(next: VibrationSettings): void {
    if (next.vibrationOn !== this.settings.vibrationOn || next.vibrationStrength !== this.settings.vibrationStrength) this.stop();
    this.settings = { ...next };
  }

  setWarnFrom(warnFrom: WarnFrom): void {
    this.warnFrom = warnFrom;
  }

  calibrated(now: number): void {
    if (!this.settings.vibrationOn) return;
    const pattern = vibrationPattern("calibrated", this.settings.vibrationStrength);
    this.vibrating = this.vibrate(pattern);
    this.calibrationUntil = now + pattern.reduce((sum, ms) => sum + ms, 0);
    this.nextAt = this.calibrationUntil + HAPTICS.minimumRestMs;
  }

  update(hazards: HazardUpdate[], ready: boolean, now: number): void {
    if (!ready || !this.settings.vibrationOn) { this.stop(); return; }
    if (now < this.calibrationUntil) return;
    const hazard = hazards.filter((h) => h.active && Number.isFinite(h.distance) && h.distance >= 0 &&
      h.distance <= this.warnFrom(h))
      .sort((a, b) => priorityOf(a) - priorityOf(b) || a.distance - b.distance)[0];
    if (!hazard) { this.stop(); return; }
    const priority = priorityOf(hazard);
    // Only a higher-priority warning interrupts an existing rhythm.
    if (now < this.nextAt && priority >= this.currentPriority) return;
    const pattern = vibrationPattern(hazard.kind, this.settings.vibrationStrength);
    this.vibrating = this.vibrate(pattern);
    this.currentPriority = priority;
    // Slowest at the warning distance. A distance at or under nearM repeats at the fastest.
    const span = this.warnFrom(hazard) - HAPTICS.nearM;
    const fraction = span > 0 ? Math.max(0, Math.min(1, (hazard.distance - HAPTICS.nearM) / span)) : 0;
    const interval = HAPTICS.nearIntervalMs + fraction * (HAPTICS.farIntervalMs - HAPTICS.nearIntervalMs);
    this.nextAt = now + Math.max(interval, pattern.reduce((sum, ms) => sum + ms, 0) + HAPTICS.minimumRestMs);
  }

  stop(): void {
    if (this.vibrating) this.vibrate(0);
    this.vibrating = false;
    this.nextAt = 0;
    this.currentPriority = Infinity;
    this.calibrationUntil = 0;
  }
}
