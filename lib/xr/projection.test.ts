import { describe, expect, it } from "vitest";
import { fieldOfView, orientationOf } from "./projection";

// Builds a column-major perspective matrix from frustum edges at the near plane.
function frustum(left: number, right: number, bottom: number, top: number, near = 0.1, far = 100) {
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

describe("fieldOfView", () => {
  it("reads a symmetric portrait view", () => {
    // 60° tall, half as wide in the image plane.
    const t = 0.1 * Math.tan(Math.PI / 6);
    const fov = fieldOfView(frustum(-t / 2, t / 2, -t, t));
    expect(fov.vertical).toBeCloseTo(60, 3);
    expect(fov.horizontal).toBeCloseTo(2 * Math.atan(Math.tan(Math.PI / 6) / 2) * (180 / Math.PI), 3);
    expect(orientationOf(fov)).toBe("portrait");
  });

  it("reads an off-centre view", () => {
    // Edges at 10° left and 30° right, 20° down and 20° up.
    const n = 0.1;
    const tan = (deg: number) => Math.tan((deg * Math.PI) / 180);
    const fov = fieldOfView(frustum(-n * tan(10), n * tan(30), -n * tan(20), n * tan(20), n));
    expect(fov.horizontal).toBeCloseTo(40, 3);
    expect(fov.vertical).toBeCloseTo(40, 3);
  });

  it("calls a wide view landscape", () => {
    expect(orientationOf({ horizontal: 64, vertical: 38 })).toBe("landscape");
  });
});
