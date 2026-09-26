// Gives each depth hazard the detector's label for it. Depth decides that a hazard exists; the
// label only picks its sound and word.

import type { LabelQuery } from "@/lib/hazard/engine";
import type { DetectorClass } from "@/lib/shared/enums";
import { DETECTOR } from "@/lib/shared/params";
import { centreOf, type Detection } from "./detections";

export class LabelMatcher {
  private detections: Detection[] = [];
  private detectedAt = -Infinity;
  // The last label per hazard, kept for a second so it doesn't flip-flop.
  private held = new Map<string, { label: DetectorClass; until: number }>();

  // `t` is the session time of the frame, in milliseconds.
  update(detections: Detection[], t: number): void {
    this.detections = detections;
    this.detectedAt = t;
  }

  reset(): void {
    this.detections = [];
    this.detectedAt = -Infinity;
    this.held.clear();
  }

  // The best detection within ±10° of the hazard and at a sensible height in the frame, the
  // label held from the last match, or null (the engine then uses pole-like or unknown).
  labelFor(query: LabelQuery, t: number, hfovDeg: number): DetectorClass | null {
    if (query.kind === "drop_off") return null;
    const fresh = t - this.detectedAt <= DETECTOR.labelHoldMs;
    let best: Detection | null = null;
    if (fresh && query.u !== null) {
      for (const d of this.detections) {
        if (Math.abs(centreOf(d.box) - query.u) * hfovDeg > DETECTOR.labelMatchWindowDeg) continue;
        const placed =
          query.kind === "head_height"
            ? d.box.top <= DETECTOR.headBoxTopMax
            : d.box.bottom >= DETECTOR.obstacleBoxBottomMin;
        if (placed && (!best || d.score > best.score)) best = d;
      }
    }
    if (best) {
      this.held.set(query.id, { label: best.label, until: t + DETECTOR.labelHoldMs });
      return best.label;
    }
    const held = this.held.get(query.id);
    if (held && t <= held.until) return held.label;
    this.held.delete(query.id);
    return null;
  }
}
