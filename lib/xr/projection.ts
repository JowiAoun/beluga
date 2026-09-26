export interface FieldOfView {
  horizontal: number;
  vertical: number;
}

const DEGREES = 180 / Math.PI;

// Reads the view's field of view in degrees from a column-major WebGL projection matrix.
// Works for off-centre (asymmetric) frustums too, which phone AR views often are.
export function fieldOfView(m: ArrayLike<number>): FieldOfView {
  const right = (1 + m[8]) / m[0];
  const left = (m[8] - 1) / m[0];
  const top = (1 + m[9]) / m[5];
  const bottom = (m[9] - 1) / m[5];
  return {
    horizontal: (Math.atan(right) - Math.atan(left)) * DEGREES,
    vertical: (Math.atan(top) - Math.atan(bottom)) * DEGREES,
  };
}

// Portrait when the view is taller than it is wide.
export function orientationOf(fov: FieldOfView): "portrait" | "landscape" {
  return fov.horizontal < fov.vertical ? "portrait" : "landscape";
}
