// Tells when the camera is covered (a privacy slider, a hand, a pocket) or it is pitch dark. Depth
// from a black image is noise, so the walk stops using it until the camera sees again.

import { SENSING } from "@/lib/shared/params";

export class DarkCamera {
  dark = false;
  private since: number | null = null;

  // `brightness` is a frame's mean, 0 to 255. Returns "dark" or "light" when the camera changes.
  update(t: number, brightness: number): "dark" | "light" | null {
    const flip = this.dark ? brightness > SENSING.cameraLightAbove : brightness < SENSING.cameraDarkBelow;
    if (!flip) {
      this.since = null;
      return null;
    }
    this.since ??= t;
    if (t - this.since < SENSING.cameraDarkAfterMs) return null;
    this.dark = !this.dark;
    this.since = null;
    return this.dark ? "dark" : "light";
  }
}
