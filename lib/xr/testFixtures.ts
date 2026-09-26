// Matrices and updates for the sensing and hazard tests. Column-major, like WebXR.
import type { SensingUpdate } from "./types";

export function frustum(left: number, right: number, bottom: number, top: number, near = 0.1, far = 100): Float32Array {
  const m = new Float32Array(16);
  m[0] = (2 * near) / (right - left);
  m[5] = (2 * near) / (top - bottom);
  m[8] = (right + left) / (right - left);
  m[9] = (top + bottom) / (top - bottom);
  m[10] = -(far + near) / (far - near);
  m[11] = -1;
  m[14] = -(2 * far * near) / (far - near);
  return m;
}

export function perspective(horizontalDeg: number, verticalDeg: number): Float32Array {
  const near = 0.1;
  const x = near * Math.tan((horizontalDeg * Math.PI) / 360);
  const y = near * Math.tan((verticalDeg * Math.PI) / 360);
  return frustum(-x, x, -y, y, near);
}

export const IDENTITY = Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

// Turns about the vertical axis by `deg` (positive turns left, from -z towards -x), then moves to x y z.
export function yaw(deg: number, x = 0, y = 0, z = 0): Float32Array {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return Float32Array.of(c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1);
}

// Repeatable noise between -1 and 1.
export function noise(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return (state / 2_147_483_648) * 2 - 1;
  };
}

// A tracked update with the phone 1.3 m above a floor at 0, facing -z.
export function makeUpdate(points: number[], overrides: Partial<SensingUpdate> = {}): SensingUpdate {
  return {
    t: 0,
    tracking: true,
    points: Float32Array.from(points),
    sampleCount: points.length / 3,
    validCount: points.length / 3,
    camera: { x: 0, y: 1.3, z: 0 },
    worldFromView: IDENTITY,
    viewFromWorld: IDENTITY,
    projection: perspective(40, 55),
    fov: { horizontal: 40, vertical: 55 },
    floorY: 0,
    floorSource: "calibrated",
    calibrating: false,
    forward: { x: 0, z: -1 },
    right: { x: 1, z: 0 },
    speed: 0,
    stationary: false,
    ...overrides,
  };
}
