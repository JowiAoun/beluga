import { describe, expect, it } from "vitest";
import { MotionTracker, type MotionState } from "./motion";
import type { Flat } from "./types";

const DEG = Math.PI / 180;

// Camera forward turned `deg` to the left of -z and tilted `down` degrees towards the floor.
function facing(deg: number, down = 0) {
  return {
    x: -Math.sin(deg * DEG) * Math.cos(down * DEG),
    y: -Math.sin(down * DEG),
    z: -Math.cos(deg * DEG) * Math.cos(down * DEG),
  };
}

// Degrees from a to b, positive when b is to the left of a.
function angleBetween(a: Flat, b: Flat): number {
  return Math.atan2(a.z * b.x - a.x * b.z, a.x * b.x + a.z * b.z) / DEG;
}

// Steps every 100 ms, walking along -z at `speed` with the camera turned `deg` left.
function run(motion: MotionTracker, ms: number, speed: number, deg: number, from = 0): MotionState {
  let state: MotionState | null = null;
  for (let t = from; t <= from + ms; t += 100) {
    state = motion.update(t, { x: 0, y: 1.3, z: (-speed * t) / 1000 }, facing(deg, 20));
  }
  return state!;
}

describe("MotionTracker", () => {
  it("flattens a tilted camera onto the floor plane", () => {
    const state = new MotionTracker().update(0, { x: 0, y: 1.3, z: 0 }, facing(0, 30));
    expect(state.forward.x).toBeCloseTo(0, 6);
    expect(state.forward.z).toBeCloseTo(-1, 6);
    expect(state.right.x).toBeCloseTo(1, 6);
    expect(state.right.z).toBeCloseTo(0, 6);
  });

  it("smooths a sudden turn over about half a second", () => {
    const motion = new MotionTracker();
    run(motion, 1000, 0, 0);
    const soon = motion.update(1100, { x: 0, y: 1.3, z: 0 }, facing(90, 20));
    const turned = angleBetween({ x: 0, z: -1 }, soon.forward);
    expect(turned).toBeGreaterThan(5);
    expect(turned).toBeLessThan(30);
    const later = run(motion, 3000, 0, 90, 1200);
    expect(angleBetween({ x: 0, z: -1 }, later.forward)).toBeCloseTo(90, 0);
  });

  it("blends in the travel direction when the phone twists on its strap", () => {
    // Walking straight along -z at 1 m/s with the camera turned 40° left.
    const state = run(new MotionTracker(), 3000, 1, 40);
    expect(state.speed).toBeCloseTo(1, 1);
    expect(angleBetween({ x: 0, z: -1 }, state.forward)).toBeCloseTo(20, 0);
  });

  it("follows the camera alone when walking slowly", () => {
    const state = run(new MotionTracker(), 3000, 0.2, 40);
    expect(angleBetween({ x: 0, z: -1 }, state.forward)).toBeCloseTo(40, 0);
  });

  it("is stationary only after 5 s of standing still, jitter included", () => {
    const motion = new MotionTracker();
    let state: MotionState | null = null;
    for (let t = 0; t <= 5100; t += 100) {
      const jitter = (t / 100) % 2 ? 0.02 : -0.02;
      state = motion.update(t, { x: jitter, y: 1.3, z: 0 }, facing(0));
      if (t === 4800) expect(state.stationary).toBe(false);
    }
    expect(state!.stationary).toBe(true);
    expect(run(motion, 1000, 0.5, 0, 5200).stationary).toBe(false);
  });

  it("keeps the last direction when the camera points at the floor", () => {
    const motion = new MotionTracker();
    motion.update(0, { x: 0, y: 1.3, z: 0 }, facing(30));
    const state = motion.update(100, { x: 0, y: 1.3, z: 0 }, { x: 0, y: -1, z: 0 });
    expect(angleBetween({ x: 0, z: -1 }, state.forward)).toBeCloseTo(30, 3);
  });

  it("forgets positions after a reset, so a jump in tracking isn't read as speed", () => {
    const motion = new MotionTracker();
    run(motion, 2000, 0, 0);
    motion.reset();
    const state = motion.update(2100, { x: 5, y: 1.3, z: 5 }, facing(0));
    expect(state.speed).toBe(0);
  });
});
