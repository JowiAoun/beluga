import { describe, expect, it } from "vitest";
import { makeUpdate } from "@/lib/xr/testFixtures";
import { nearestAhead, toCorridor } from "./corridor";

// A wall across the walk at `ahead` metres, points every 10 cm from 0.2 to 1.8 m up.
function wall(ahead: number, fromX = -1, toX = 1): number[] {
  const out: number[] = [];
  for (let x = fromX; x <= toX + 1e-9; x += 0.1) {
    for (let y = 0.2; y <= 1.8 + 1e-9; y += 0.1) out.push(x, y, -ahead);
  }
  return out;
}

describe("toCorridor", () => {
  it("measures ahead, to the right and above the floor", () => {
    const p = toCorridor(0.3, 0.5, -2, makeUpdate([], { floorY: 0.1 }), { ahead: 0, lateral: 0, height: 0 });
    expect(p.ahead).toBeCloseTo(2, 6);
    expect(p.lateral).toBeCloseTo(0.3, 6);
    expect(p.height).toBeCloseTo(0.4, 6);
  });
});

describe("nearestAhead", () => {
  it("reads a wall across the corridor", () => {
    expect(nearestAhead(makeUpdate(wall(2)))).toBeCloseTo(2, 6);
  });

  it("follows the walking direction", () => {
    // Facing +x, with a wall 1.5 m away on that side.
    const points: number[] = [];
    for (let z = -1; z <= 1; z += 0.1) for (let y = 0.2; y <= 1.8; y += 0.1) points.push(1.5, y, z);
    const update = makeUpdate(points, { forward: { x: 1, z: 0 }, right: { x: 0, z: 1 } });
    expect(nearestAhead(update)).toBeCloseTo(1.5, 6);
  });

  it("ignores the floor, things beside the corridor and things overhead", () => {
    const floor: number[] = [];
    for (let z = 0.5; z <= 3; z += 0.1) for (let x = -0.4; x <= 0.4; x += 0.1) floor.push(x, 0.05, -z);
    const beside = wall(1, 0.6, 1.2);
    const overhead: number[] = [];
    for (let x = -0.4; x <= 0.4; x += 0.1) overhead.push(x, 2.1, -1);
    expect(nearestAhead(makeUpdate([...floor, ...beside, ...overhead]))).toBeNull();
  });

  it("needs a few points, so stray depth noise doesn't count", () => {
    const stray = [0, 1, -0.8, 0.1, 1.2, -0.9, -0.1, 0.9, -1.1];
    expect(nearestAhead(makeUpdate([...stray, ...wall(2.5)]))).toBeCloseTo(2.5, 6);
  });

  it("stops at the given distance", () => {
    expect(nearestAhead(makeUpdate(wall(4)))).toBeNull();
    expect(nearestAhead(makeUpdate(wall(4)), 5)).toBeCloseTo(4, 6);
  });
});
