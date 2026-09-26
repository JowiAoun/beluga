import { SENSING } from "@/lib/shared/params";

// Floor height at a distance ahead, relative to the tracked floor: intercept + slope × ahead.
export interface FloorLine {
  intercept: number;
  slope: number;
}

export const FLAT: FloorLine = { intercept: 0, slope: 0 };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A median-based line through floor points: the slope joins the medians of the near half and
// the far half, and the intercept is the median offset. A few stray points can't tilt it.
export function fitLine(aheads: number[], heights: number[]): FloorLine {
  const n = aheads.length;
  if (n < SENSING.floorLineMinPoints) return FLAT;
  const order = aheads.map((_, i) => i).sort((a, b) => aheads[a] - aheads[b]);
  const near = order.slice(0, n >> 1);
  const far = order.slice(n >> 1);
  const nearAhead = median(near.map((i) => aheads[i]));
  const farAhead = median(far.map((i) => aheads[i]));

  let slope = 0;
  if (farAhead - nearAhead >= SENSING.floorLineMinSpreadM) {
    slope = (median(far.map((i) => heights[i])) - median(near.map((i) => heights[i]))) / (farAhead - nearAhead);
    slope = Math.max(-SENSING.floorSlopeClamp, Math.min(SENSING.floorSlopeClamp, slope));
  }
  return { intercept: median(heights.map((h, i) => h - slope * aheads[i])), slope };
}

// Fits the floor under the walking corridor in two passes: first through points near the tracked
// floor, then through points near that first line, so a ramp's far end joins in the second pass.
export function fitFloorLine(
  ahead: Float32Array,
  lateral: Float32Array,
  height: Float32Array,
  maxAheadM: number = SENSING.dropOffAheadMaxM,
): FloorLine {
  let line = FLAT;
  for (let pass = 0; pass < 2; pass++) {
    const aheads: number[] = [];
    const heights: number[] = [];
    for (let i = 0; i < ahead.length; i++) {
      const a = ahead[i];
      if (a < SENSING.corridorAheadMinM || a > maxAheadM) continue;
      if (Math.abs(lateral[i]) > SENSING.corridorHalfWidthM) continue;
      const h = height[i] - (line.intercept + line.slope * a);
      if (h < SENSING.floorBandM.low || h > SENSING.floorBandM.high) continue;
      aheads.push(a);
      heights.push(height[i]);
    }
    line = fitLine(aheads, heights);
  }
  return line;
}
