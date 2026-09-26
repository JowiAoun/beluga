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
}

export const NO_DEPTH: DepthSample = { points: new Float32Array(0), sampleCount: 0, validCount: 0 };

// The grid's longer side runs along the view's longer side, so samples stay evenly spaced in portrait.
export function gridFor(fov: FieldOfView, grid: DepthGrid = SENSING.depthGrid): DepthGrid {
  const long = Math.max(grid.cols, grid.rows);
  const short = Math.min(grid.cols, grid.rows);
  return fov.vertical > fov.horizontal ? { cols: short, rows: long } : { cols: long, rows: short };
}

// Reads depth at the centre of each grid cell and turns every reading in range into a world point.
// Zero means no reading, and NaN fails the range check too.
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
  let n = 0;
  for (let row = 0; row < grid.rows; row++) {
    const v = (row + 0.5) / grid.rows;
    for (let col = 0; col < grid.cols; col++) {
      const u = (col + 0.5) / grid.cols;
      const d = depth.getDepthInMeters(u, v);
      if (!(d >= minM && d <= maxM)) continue;
      transformPoint(worldFromView, unproject(u, v, d, projection, p), p);
      points[n * 3] = p.x;
      points[n * 3 + 1] = p.y;
      points[n * 3 + 2] = p.z;
      n++;
    }
  }
  return { points: points.subarray(0, n * 3), sampleCount, validCount: n };
}
