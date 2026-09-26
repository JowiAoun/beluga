import { SENSING } from "@/lib/shared/params";

export type TrackingChange = "lost" | "regained";

export interface TrackingStep {
  change: TrackingChange | null;
  // True when "hold steady" should play: on a loss, at most once per cooldown.
  cue: boolean;
}

const NOTHING: TrackingStep = { change: null, cue: false };

// Tracking counts as lost once the pose has been missing or emulated for longer than trackingLostMs.
export class TrackingMonitor {
  lost = false;
  private badSince: number | null = null;
  private lastCue: number | null = null;

  update(t: number, poseOk: boolean): TrackingStep {
    if (poseOk) {
      this.badSince = null;
      if (!this.lost) return NOTHING;
      this.lost = false;
      return { change: "regained", cue: false };
    }
    this.badSince ??= t;
    if (this.lost || t - this.badSince <= SENSING.trackingLostMs) return NOTHING;
    this.lost = true;
    const cue = this.lastCue === null || t - this.lastCue >= SENSING.holdSteadyCooldownMs;
    if (cue) this.lastCue = t;
    return { change: "lost", cue };
  }
}
