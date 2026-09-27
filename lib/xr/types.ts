import type { FieldOfView } from "./projection";

// Metres, in the session's reference space: y is up, the floor plane is x and z.
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// A direction on the floor plane.
export interface Flat {
  x: number;
  z: number;
}

export type FloorSource = "guess" | "hit_test" | "calibrated";

// What the sensing loop hands the rest of the app about ten times a second. Plain data only,
// so the replay recorder (Phase 10) can save it as is.
export interface SensingUpdate {
  // Milliseconds since the session started.
  t: number;
  // False while tracking is lost: points is empty and the hazard engine should hold still.
  tracking: boolean;
  // The camera is covered or pitch dark, so no depth is used and tracking reads false.
  dark?: boolean;
  // World points from depth, x y z one after another.
  points: Float32Array;
  sampleCount: number;
  validCount: number;
  // Grid cells left out because their depth readings didn't agree. Missing in older replays.
  unsteadyCount?: number;
  camera: Vec3;
  // Column-major 4 × 4 matrices of this update's view. Phase 2 uses them to tell if a point is in view.
  worldFromView: Float32Array;
  viewFromWorld: Float32Array;
  projection: Float32Array;
  fov: FieldOfView;
  // Height of the floor in the reference space.
  floorY: number;
  floorSource: FloorSource;
  calibrating: boolean;
  // The floor has looked wrong for a while: the walk suggests calibrating again.
  floorDoubtful?: boolean;
  // Walking direction and its right-hand side, unit length on the floor plane.
  forward: Flat;
  right: Flat;
  // Metres per second over the last second.
  speed: number;
  stationary: boolean;
}
