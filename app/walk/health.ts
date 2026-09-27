// Keeps a walk going, and flags what stopped when it can't. Warnings need three things to keep
// arriving: sensing updates, trusted depth, and a running sound. A problem plays a short alert
// once, with nothing on screen, and each one is counted for the walk summary.

import { WALK_HEALTH } from "@/lib/shared/params";

export type Problem = "frames" | "depth" | "sound";

// A paused sound can't play the alert, so the phone's own voice says this instead.
export const SOUND_PAUSED_TEXT = "The phone paused beluga's sound. Tap the screen to turn it back on.";

export interface HealthInput {
  // performance.now() now, at the last sensing update, and at the last update with trusted depth
  // (or one that needed none). Null before the first.
  now: number;
  lastUpdateAt: number | null;
  lastDepthAt: number | null;
  soundRunning: boolean;
}

export interface HealthCounts {
  frames: number;
  depth: number;
  sound: number;
  // Times Android let go of the screen lock.
  screen: number;
}

export class HealthWatch {
  private problem: Problem | null = null;
  private soundPausedSince: number | null = null;
  readonly counts: HealthCounts = { frames: 0, depth: 0, sound: 0, screen: 0 };

  // The problem now, most serious first, and whether it just started (to alert once).
  update(input: HealthInput): { problem: Problem | null; started: boolean } {
    const { now } = input;
    if (input.soundRunning) this.soundPausedSince = null;
    else this.soundPausedSince ??= now;

    let problem: Problem | null = null;
    if (input.lastUpdateAt !== null && now - input.lastUpdateAt > WALK_HEALTH.framesMissingMs) problem = "frames";
    else if (input.lastDepthAt !== null && now - input.lastDepthAt > WALK_HEALTH.depthMissingMs) problem = "depth";
    else if (this.soundPausedSince !== null && now - this.soundPausedSince > WALK_HEALTH.soundPausedMs) {
      problem = "sound";
    }

    const started = problem !== null && problem !== this.problem;
    if (started) this.counts[problem!]++;
    this.problem = problem;
    return { problem, started };
  }
}

// Keeps the screen on for the whole walk. Android lets go of the lock whenever the page is hidden
// for a moment, and a screen that then times out ends the AR session, so it is taken again each
// time the page shows, and on each `retry`.
export function keepScreenOn(onLost: () => void): { retry: () => void; stop: () => void } {
  let lock: WakeLockSentinel | null = null;
  let asking = false;
  let stopped = false;
  const take = async () => {
    if (stopped || lock || asking || document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
    asking = true;
    try {
      const next = await navigator.wakeLock.request("screen");
      if (stopped) {
        void next.release();
        return;
      }
      lock = next;
      next.addEventListener("release", () => {
        lock = null;
        if (stopped) return;
        onLost();
        void take();
      });
    } catch {
      // Not allowed right now. The next time the page shows, or the next retry, tries again.
    } finally {
      asking = false;
    }
  };
  const onVisibility = () => void take();
  document.addEventListener("visibilitychange", onVisibility);
  void take();
  return {
    retry: () => void take(),
    stop: () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    },
  };
}
