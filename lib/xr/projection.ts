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

// A centred WebGL projection for a camera that sees `horizontalDeg` by `verticalDeg`, column-major.
// Camera mode has no AR view to take one from.
export function perspectiveFor(horizontalDeg: number, verticalDeg: number, near = 0.1, far = 100): Float32Array {
  const m = new Float32Array(16);
  m[0] = 1 / Math.tan((horizontalDeg * Math.PI) / 360);
  m[5] = 1 / Math.tan((verticalDeg * Math.PI) / 360);
  m[10] = -(far + near) / (far - near);
  m[11] = -1;
  m[14] = -(2 * far * near) / (far - near);
  return m;
}
