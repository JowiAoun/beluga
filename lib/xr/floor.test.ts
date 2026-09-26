import { describe, expect, it } from "vitest";
import { SENSING } from "@/lib/shared/params";
import { FloorTracker } from "./floor";
import { noise } from "./testFixtures";
import type { Vec3 } from "./types";

const forward = { x: 0, z: -1 };
const right = { x: 1, z: 0 };

// Depth points in front of a phone at `camera`: floor at `floorY` with ±2 cm of noise, the top of a
// box 0.75 m up, and a few stray points far below the floor.
function scene(camera: Vec3, floorY: number, rand: () => number): Float32Array {
  const out: number[] = [];
  for (let x = -0.4; x <= 0.4; x += 0.1) {
    for (let d = 0.6; d <= 1.9; d += 0.1) out.push(camera.x + x, floorY + rand() * 0.02, camera.z - d);
  }
  for (let x = -0.2; x <= 0.2; x += 0.1) out.push(camera.x + x, floorY + 0.75, camera.z - 1.1);
  for (let i = 0; i < 3; i++) out.push(camera.x, floorY - 0.5, camera.z - 1);
  return Float32Array.from(out);
}

// Calls update every 100 ms while the phone moves at `speed` along -z. Returns the events seen.
function walk(floor: FloorTracker, from: number, ms: number, speed: number, floorY: number, rand: () => number) {
  const events: string[] = [];
  for (let t = from; t <= from + ms; t += 100) {
    const camera = { x: 0, y: floorY + 1.3, z: (-speed * t) / 1000 };
    const event = floor.update(t, scene(camera, floorY, rand), camera, forward, right);
    if (event) events.push(event);
  }
  return events;
}

describe("FloorTracker", () => {
  it("starts from the guess, then takes the median of the first hits", () => {
    const floor = new FloorTracker(0);
    expect(floor.source).toBe("guess");
    // Too close under the phone to be the floor.
    floor.addHit(1.1, 1.3);
    for (const y of [0.05, 0.04, 0.06, 0.05]) floor.addHit(y, 1.3);
    expect(floor.source).toBe("guess");
    floor.addHit(0.03, 1.3);
    expect(floor.source).toBe("hit_test");
    expect(floor.y).toBeCloseTo(0.05, 6);
  });

  it("calibrates on the floor during three slow steps, ignoring a box and stray points", () => {
    const floor = new FloorTracker(-0.3);
    const events = walk(floor, 0, 4000, 0.5, 0, noise(3));
    expect(events).toEqual(["calibration_started", "calibrated"]);
    expect(floor.source).toBe("calibrated");
    expect(floor.y).toBeGreaterThan(-0.03);
    expect(floor.y).toBeLessThan(0.01);
  });

  it("calibrates on a timer when the phone stays still", () => {
    const floor = new FloorTracker(-0.3);
    const events = walk(floor, 0, SENSING.calibrationMaxMs - 200, 0, 0, noise(4));
    expect(events).toEqual(["calibration_started"]);
    expect(walk(floor, SENSING.calibrationMaxMs, 100, 0, 0, noise(5))).toEqual(["calibrated"]);
  });

  it("keeps the hit test's floor when the floor stays out of view during calibration", () => {
    const floor = new FloorTracker(-0.3);
    for (const y of [0.02, 0.01, 0.03, 0.02, 0.02]) floor.addHit(y, 1.3);
    const camera = { x: 0, y: 1.3, z: 0 };
    const events: string[] = [];
    for (let t = 0; t <= SENSING.calibrationMaxMs + 5000; t += 100) {
      const event = floor.update(t, new Float32Array(0), camera, forward, right);
      if (event) events.push(event);
    }
    expect(events).toEqual(["calibration_started", "calibration_unavailable"]);
    expect(floor.calibrating).toBe(true);
    expect(floor.source).toBe("hit_test");
    expect(floor.y).toBeCloseTo(0.02, 6);
  });

  it("does not report calibration when neither depth nor a hit test found floor", () => {
    const floor = new FloorTracker(-0.3);
    const camera = { x: 0, y: 1.3, z: 0 };
    const events: string[] = [];
    for (let t = 0; t <= SENSING.calibrationMaxMs + 100; t += 100) {
      const event = floor.update(t, new Float32Array(0), camera, forward, right);
      if (event) events.push(event);
    }
    expect(events).toEqual(["calibration_started", "calibration_unavailable"]);
    expect(floor.source).toBe("guess");
    expect(floor.y).toBe(-0.3);
  });

  it("finishes automatically when floor samples arrive after the timeout", () => {
    const floor = new FloorTracker(-0.3);
    const camera = { x: 0, y: 1.3, z: 0 };
    floor.update(0, new Float32Array(0), camera, forward, right);
    expect(floor.update(SENSING.calibrationMaxMs, new Float32Array(0), camera, forward, right)).toBe("calibration_unavailable");
    expect(floor.calibrated).toBe(false);
    const events = walk(floor, SENSING.calibrationMaxMs + 100, 1000, 0, 0, noise(19));
    expect(events).toEqual(["calibrated"]);
    expect(floor.calibrating).toBe(false);
    expect(floor.calibrated).toBe(true);
  });

  it("does not accept a sparse depth sample at the timeout", () => {
    const floor = new FloorTracker(0);
    const camera = { x: 0, y: 1.3, z: 0 };
    floor.update(0, scene(camera, 0, noise(21)), camera, forward, right);
    expect(floor.update(SENSING.calibrationMaxMs, new Float32Array(0), camera, forward, right)).toBe("calibration_unavailable");
    expect(floor.calibrated).toBe(false);
  });

  it("follows slow drift near the floor and ignores anything outside the band", () => {
    const floor = new FloorTracker(0);
    walk(floor, 0, 4000, 0.5, 0, noise(6));
    const calibrated = floor.y;

    // The tracked floor drifts up 5 cm, as ARCore's floor can over a long walk.
    walk(floor, 4100, SENSING.floorReestimateMs, 0.5, 0.05, noise(7));
    expect(floor.y - calibrated).toBeGreaterThan(0.005);
    expect(floor.y - calibrated).toBeLessThan(0.05);

    walk(floor, 9200, 60_000, 0.5, 0.05, noise(8));
    expect(floor.y).toBeCloseTo(0.05, 1);

    // A step 0.3 m up is outside the band, so the floor never follows it. Points from just
    // before the step still count once, which moves it by under a millimetre.
    const before = floor.y;
    walk(floor, 70_000, 20_000, 0.5, 0.35, noise(9));
    expect(Math.abs(floor.y - before)).toBeLessThan(0.005);
  });

  it("ignores hits after calibration", () => {
    const floor = new FloorTracker(0);
    walk(floor, 0, 4000, 0.5, 0, noise(10));
    const y = floor.y;
    for (let i = 0; i < 10; i++) floor.addHit(0.4, 1.3);
    expect(floor.y).toBe(y);
  });
});
