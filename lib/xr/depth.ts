import { SENSING } from "@/lib/shared/params";
import { transformPoint, unproject } from "./geometry";
import type { FieldOfView } from "./projection";
import type { Vec3 } from "./types";

// The one method used from XRCPUDepthInformation, so tests can pass a fake. It takes
// normalized view coordinates and applies the depth buffer's transform and scale itself.
export interface DepthReader {
  getDepthInMeters(u: number, v: number): number;
}

export interface DepthGrid {
  cols: number;
  rows: number;
}

export interface DepthSample {
  // x y z one after another, in the space `worldFromView` maps into.
  points: Float32Array;
  sampleCount: number;
  validCount: number;
  // Cells with readings that didn't agree with each other, left out of `points`.
  unsteadyCount: number;
  // The sum of every reading, which only repeats when the depth image does.
  fingerprint: number;
}

export const NO_DEPTH: DepthSample = {
  points: new Float32Array(0),
  sampleCount: 0,
  validCount: 0,
  unsteadyCount: 0,
  fingerprint: 0,
};

// Where each cell is read, as a share of the cell from its centre: the centre and four corners
// around it, each on a different pixel of ARCore's 160 × 120 depth image.
const READS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

// The depth a cell can trust: the mean of the largest group of readings that agree, or NaN when
// fewer than `depthAgreeMin` agree. A speck of noise is outvoted, and a cell on an object's edge
// takes the surface most of it sees, never a made-up depth between the two.
export function steadyDepth(readings: ArrayLike<number>, count: number): number {
  let best = 0;
  let bestSum = 0;
  for (let i = 0; i < count; i++) {
    const tolerance = Math.max(SENSING.depthAgreeM, SENSING.depthAgreeShare * readings[i]);
    let agree = 0;
    let sum = 0;
    for (let j = 0; j < count; j++) {
      if (Math.abs(readings[j] - readings[i]) <= tolerance) {
        agree++;
        sum += readings[j];
      }
    }
    if (agree > best) {
      best = agree;
      bestSum = sum;
    }
  }
  return best >= SENSING.depthAgreeMin ? bestSum / best : NaN;
}

// The grid's longer side runs along the view's longer side, so samples stay evenly spaced in portrait.
export function gridFor(fov: FieldOfView, grid: DepthGrid = SENSING.depthGrid): DepthGrid {
  const long = Math.max(grid.cols, grid.rows);
  const short = Math.min(grid.cols, grid.rows);
  return fov.vertical > fov.horizontal ? { cols: short, rows: long } : { cols: long, rows: short };
}

// Reads depth at five spots in each grid cell and turns each cell whose readings agree into a
// world point. Zero means no reading, and NaN fails the range check too.
export function sampleDepth(
  depth: DepthReader,
  projection: ArrayLike<number>,
  worldFromView: ArrayLike<number>,
  grid: DepthGrid,
  minM: number = SENSING.depthMinM,
  maxM: number = SENSING.depthMaxM,
): DepthSample {
  const sampleCount = grid.cols * grid.rows;
  const points = new Float32Array(sampleCount * 3);
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  const readings = new Float64Array(READS.length);
  const du = SENSING.depthReadSpread / grid.cols;
  const dv = SENSING.depthReadSpread / grid.rows;
  let n = 0;
  let unsteady = 0;
  let fingerprint = 0;
  for (let row = 0; row < grid.rows; row++) {
    const v = (row + 0.5) / grid.rows;
    for (let col = 0; col < grid.cols; col++) {
      const u = (col + 0.5) / grid.cols;
      let count = 0;
      for (const [x, y] of READS) {
        const d = depth.getDepthInMeters(u + x * du, v + y * dv);
        if (Number.isFinite(d)) fingerprint += d;
        if (d >= minM && d <= maxM) readings[count++] = d;
      }
      if (count === 0) continue;
      const d = steadyDepth(readings, count);
      if (Number.isNaN(d)) {
        unsteady++;
        continue;
      }
      transformPoint(worldFromView, unproject(u, v, d, projection, p), p);
      points[n * 3] = p.x;
      points[n * 3 + 1] = p.y;
      points[n * 3 + 2] = p.z;
      n++;
    }
  }
  return { points: points.subarray(0, n * 3), sampleCount, validCount: n, unsteadyCount: unsteady, fingerprint };
}

// Tells when depth has gone stale: the same depth image while the phone has moved or turned.
export class StaleDepth {
  private print = NaN;
  private since = 0;
  private camera: Vec3 = { x: 0, y: 0, z: 0 };
  private forward: Vec3 = { x: 0, y: 0, z: -1 };

  // True when this sample repeats one from over depthFrozenAfterMs ago and the phone has moved
  // since, so it shouldn't be used. `forward` is the view's unit forward direction.
  update(t: number, sample: DepthSample, camera: Vec3, forward: Vec3): boolean {
    if (sample.validCount === 0) return false;
    if (sample.fingerprint !== this.print) {
      this.print = sample.fingerprint;
      this.since = t;
      this.camera = { ...camera };
      this.forward = { ...forward };
      return false;
    }
    if (t - this.since < SENSING.depthFrozenAfterMs) return false;
    const moved = Math.hypot(camera.x - this.camera.x, camera.y - this.camera.y, camera.z - this.camera.z);
    const dot = forward.x * this.forward.x + forward.y * this.forward.y + forward.z * this.forward.z;
    const turned = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
    return moved > SENSING.depthFrozenMoveM || turned > SENSING.depthFrozenTurnDeg;
  }
}
