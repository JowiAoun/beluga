// How far the phone leans, from the camera pose, and how to fix it when it leans too far to see
// the walking path. Pure logic, so it runs the same on the phone and in tests.

import { TILT } from "@/lib/shared/params";

const DEG = 180 / Math.PI;

export interface Tilt {
  // Positive when the camera points above straight ahead.
  pitchDeg: number;
  // Positive when the phone's right edge is higher than its left, as you look at the screen.
  rollDeg: number;
}

// What to do: point the camera lower or higher, or turn the phone upright one way or the other.
export type TiltFix = "lower" | "higher" | "clockwise" | "counterclockwise";

// Reads the tilt from a column-major worldFromView matrix: the view looks down its -z axis, and
// its x axis runs across the screen.
export function tiltOf(worldFromView: ArrayLike<number>): Tilt {
  const forwardY = -worldFromView[9];
  const rightY = worldFromView[1];
  const upY = worldFromView[5];
  return {
    pitchDeg: Math.asin(Math.max(-1, Math.min(1, forwardY))) * DEG,
    rollDeg: Math.atan2(rightY, upY) * DEG,
  };
}

// The fix for a tilt past the limits, brought in by `margin` degrees. Turning comes first: a phone
// on its side reads its pitch wrong.
export function fixFor(tilt: Tilt, margin = 0): TiltFix | null {
  if (Math.abs(tilt.rollDeg) > TILT.sideMaxDeg - margin) return tilt.rollDeg > 0 ? "clockwise" : "counterclockwise";
  if (tilt.pitchDeg > TILT.upMaxDeg - margin) return "lower";
  if (tilt.pitchDeg < -(TILT.downMaxDeg - margin)) return "higher";
  return null;
}

// Says how to fix the tilt once it has been past the limits for a moment, and keeps saying it until
// the phone is back inside them by a margin, so a sway never flashes the banner.
export class TiltWatch {
  private fix: TiltFix | null = null;
  private offSince: number | null = null;

  update(t: number, tilt: Tilt): TiltFix | null {
    if (this.fix) {
      this.fix = fixFor(tilt, TILT.clearMarginDeg);
      if (!this.fix) this.offSince = null;
      return this.fix;
    }
    const fix = fixFor(tilt);
    if (!fix) {
      this.offSince = null;
      return null;
    }
    this.offSince ??= t;
    if (t - this.offSince >= TILT.showAfterMs) this.fix = fix;
    return this.fix;
  }

  reset(): void {
    this.fix = null;
    this.offSince = null;
  }
}
