import { describe, expect, it } from "vitest";
import { forwardOf, toViewCoords, transformPoint, unproject, upOf } from "./geometry";
import { frustum, IDENTITY, perspective, yaw } from "./testFixtures";

describe("unproject", () => {
  it("puts the view centre straight ahead at the measured depth", () => {
    const p = unproject(0.5, 0.5, 2, perspective(40, 55), { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBe(-2);
  });

  it("puts the top left corner up and to the left", () => {
    const p = unproject(0, 0, 1, perspective(40, 55), { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(-Math.tan((20 * Math.PI) / 180), 5);
    expect(p.y).toBeCloseTo(Math.tan((27.5 * Math.PI) / 180), 5);
  });

  it("round-trips through toViewCoords on an off-centre view", () => {
    const projection = frustum(-0.02, 0.05, -0.04, 0.03);
    for (const [u, v, d] of [
      [0.1, 0.2, 0.7],
      [0.5, 0.5, 2],
      [0.9, 0.75, 4.2],
    ]) {
      const p = unproject(u, v, d, projection, { x: 0, y: 0, z: 0 });
      expect(p.z).toBeCloseTo(-d, 6);
      const back = toViewCoords(p, IDENTITY, projection);
      expect(back?.u).toBeCloseTo(u, 5);
      expect(back?.v).toBeCloseTo(v, 5);
    }
  });
});

describe("transforms", () => {
  it("turns and moves a point into the world", () => {
    // A camera 1.5 m up, turned 90° left: its straight ahead is the world's -x.
    const p = transformPoint(yaw(90, 0, 1.5, 0), { x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(-2, 6);
    expect(p.y).toBeCloseTo(1.5, 6);
    expect(p.z).toBeCloseTo(0, 6);
    const f = forwardOf(yaw(90));
    expect(f.x).toBeCloseTo(-1, 6);
    expect(f.z).toBeCloseTo(0, 6);
  });

  it("says nothing about points behind the camera", () => {
    expect(toViewCoords({ x: 0, y: 0, z: 1 }, IDENTITY, perspective(40, 55))).toBeNull();
  });

  it("tells a floor from a wall by the hit's up axis", () => {
    expect(upOf({ x: 0, z: 0 })).toBe(1);
    // Turned 90° about x: the pose's y axis now lies flat, like a wall's normal.
    expect(upOf({ x: Math.SQRT1_2, z: 0 })).toBeCloseTo(0, 6);
  });
});
