import type { Vec3 } from "./types";

// Normalized view coordinates: 0 to 1 across the view, origin top left, y growing down.
export interface ViewCoords {
  u: number;
  v: number;
}

// View-space point for normalized view coordinates and a depth measured along the camera's
// forward axis. Reads the frustum straight from a column-major perspective matrix, which
// handles the off-centre views phones often have.
export function unproject(u: number, v: number, depth: number, projection: ArrayLike<number>, out: Vec3): Vec3 {
  const ndcX = 2 * u - 1;
  const ndcY = 1 - 2 * v;
  out.x = (depth * (ndcX + projection[8])) / projection[0];
  out.y = (depth * (ndcY + projection[9])) / projection[5];
  out.z = -depth;
  return out;
}

// Applies a column-major 4 × 4 rigid transform to a point. `out` may be `p`.
export function transformPoint(m: ArrayLike<number>, p: Vec3, out: Vec3): Vec3 {
  const { x, y, z } = p;
  out.x = m[0] * x + m[4] * y + m[8] * z + m[12];
  out.y = m[1] * x + m[5] * y + m[9] * z + m[13];
  out.z = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

// The camera looks down its own -z axis.
export function forwardOf(worldFromView: ArrayLike<number>): Vec3 {
  return { x: -worldFromView[8], y: -worldFromView[9], z: -worldFromView[10] };
}

// Up component of a pose's y axis. A hit on a floor is close to 1, on a wall close to 0.
export function upOf(q: { x: number; z: number }): number {
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}

const scratch: Vec3 = { x: 0, y: 0, z: 0 };

// Where a world point lands in the view, or null when it is behind the camera.
// Inside the view means both u and v are between 0 and 1.
export function toViewCoords(
  point: Vec3,
  viewFromWorld: ArrayLike<number>,
  projection: ArrayLike<number>,
): ViewCoords | null {
  const p = transformPoint(viewFromWorld, point, scratch);
  if (p.z >= 0) return null;
  const w = -p.z;
  const ndcX = (projection[0] * p.x + projection[8] * p.z) / w;
  const ndcY = (projection[5] * p.y + projection[9] * p.z) / w;
  return { u: (ndcX + 1) / 2, v: (1 - ndcY) / 2 };
}
