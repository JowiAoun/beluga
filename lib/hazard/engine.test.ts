import { describe, expect, it } from "vitest";
import { toViewCoords } from "@/lib/xr/geometry";
import { makeUpdate, noise, perspective, yaw } from "@/lib/xr/testFixtures";
import type { SensingUpdate } from "@/lib/xr/types";
import { HazardEngine, priorityOf, type EngineResult } from "./engine";

// The phone 1.3 m up at (x, z), level, facing -z, with a portrait view 40° wide × 74° tall.
function at(z: number, points: number[], t: number, x = 0): SensingUpdate {
  return makeUpdate(points, {
    t,
    camera: { x, y: 1.3, z },
    worldFromView: yaw(0, x, 1.3, z),
    viewFromWorld: yaw(0, -x, -1.3, -z),
    projection: perspective(40, 74),
    fov: { horizontal: 40, vertical: 74 },
  });
}

// Keeps only the points the camera at this pose can see.
function visible(points: number[], update: SensingUpdate): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    const v = toViewCoords({ x: points[i], y: points[i + 1], z: points[i + 2] }, update.viewFromWorld, update.projection);
    if (v && v.u >= 0 && v.u <= 1 && v.v >= 0 && v.v <= 1) out.push(points[i], points[i + 1], points[i + 2]);
  }
  return out;
}

function grid(x: [number, number], y: [number, number], z: [number, number], step = 0.05): number[] {
  const out: number[] = [];
  const range = ([a, b]: [number, number]) => {
    const values: number[] = [];
    for (let v = a; v <= b + 1e-9; v += step) values.push(v);
    return values.length > 0 ? values : [a];
  };
  for (const px of range(x)) for (const py of range(y)) for (const pz of range(z)) out.push(px, py, pz);
  return out;
}

// Floor in front of a phone at z, from `from` to `to` metres ahead, with a height at each distance.
function floor(z: number, from = 0.3, to = 3.5, heightAt: (ahead: number) => number = () => 0, rand?: () => number): number[] {
  const out: number[] = [];
  for (let a = from; a <= to + 1e-9; a += 0.05) {
    for (let x = -0.6; x <= 0.6 + 1e-9; x += 0.1) out.push(x, heightAt(a) + (rand ? rand() * 0.02 : 0), z - a);
  }
  return out;
}

// Runs the same scene for a few updates and returns the last result.
function settle(engine: HazardEngine, points: number[], updates = 4): EngineResult {
  let result: EngineResult | null = null;
  for (let i = 0; i < updates; i++) result = engine.update(at(0, points, i * 100));
  return result!;
}

describe("HazardEngine scenes", () => {
  it("stays silent on an empty flat floor", () => {
    const engine = new HazardEngine();
    for (let i = 0; i < 10; i++) {
      const result = engine.update(at(0, floor(0, 0.3, 3.5, () => 0, noise(i + 1)), i * 100));
      expect(result.hazards).toEqual([]);
      expect(result.events).toEqual([]);
    }
  });

  it("finds a wall 2 m ahead across the whole path", () => {
    const engine = new HazardEngine();
    const scene = [...floor(0, 0.3, 1.95), ...grid([-1, 1], [0, 2.5], [-2, -2], 0.1)];
    expect(engine.update(at(0, scene, 0)).hazards).toEqual([]);
    expect(engine.update(at(0, scene, 100)).hazards).toEqual([]);
    const result = engine.update(at(0, scene, 200));
    expect(result.hazards).toHaveLength(1);
    const [wall] = result.hazards;
    expect(wall.kind).toBe("obstacle");
    expect(wall.distance).toBeCloseTo(2, 2);
    expect(wall.blocking).toBe(1);
    expect(Math.abs(wall.angle)).toBeLessThan(3);
    expect(result.events.map((e) => e.type)).toEqual(["hazard_seen"]);
  });

  it("flags a pole 1.5 m ahead, 0.3 m left", () => {
    const pole = grid([-0.32, -0.28], [0, 2.4], [-1.5, -1.5], 0.02);
    const [hazard, ...rest] = settle(new HazardEngine(), [...floor(0, 0.3, 1.45), ...pole]).hazards;
    expect(rest).toEqual([]);
    expect(hazard.kind).toBe("obstacle");
    expect(hazard.label).toBe("pole_like");
    expect(hazard.distance).toBeCloseTo(1.5, 2);
    expect(hazard.angle).toBeCloseTo((Math.atan2(-0.3, 1.5) * 180) / Math.PI, 0);
  });

  it("finds a board at head height with nothing below it", () => {
    const board = grid([-0.3, 0.3], [1.6, 1.9], [-1.8, -1.8]);
    const hazards = settle(new HazardEngine(), [...floor(0), ...board]).hazards;
    expect(hazards).toHaveLength(1);
    expect(hazards[0].kind).toBe("head_height");
    expect(hazards[0].distance).toBeCloseTo(1.8, 2);
  });

  it("puts a drop-off at the edge, where the floor ends 2 m ahead", () => {
    // From 1.3 m up, a floor 0.8 m lower only shows past 2 × 2.1 / 1.3 ≈ 3.23 m.
    const scene = [...floor(0, 0.3, 2.0), ...floor(0, 3.25, 3.5, () => -0.8)];
    const hazards = settle(new HazardEngine(), scene).hazards;
    expect(hazards).toHaveLength(1);
    expect(hazards[0].kind).toBe("drop_off");
    expect(hazards[0].distance).toBeCloseTo(2, 1);
  });

  it("finds a single step down of 18 cm", () => {
    const scene = [...floor(0, 0.3, 2.0), ...floor(0, 2.3, 3.5, () => -0.18)];
    const hazards = settle(new HazardEngine(), scene).hazards;
    expect(hazards).toHaveLength(1);
    expect(hazards[0].kind).toBe("drop_off");
    expect(hazards[0].distance).toBeCloseTo(2, 1);
  });

  it("ignores a noisy floor with scattered single points", () => {
    const engine = new HazardEngine();
    const stray: number[] = [];
    // One point every 25 cm ahead, cycling through the buckets and heights.
    for (let k = 0; k < 11; k++) stray.push(-0.36 + (k % 5) * 0.18, 0.3 + (k % 4) * 0.4, -(0.4 + k * 0.25));
    for (let i = 0; i < 6; i++) {
      const result = engine.update(at(0, [...floor(0, 0.3, 3.5, () => 0, noise(i + 20)), ...stray], i * 100));
      expect(result.hazards).toEqual([]);
    }
  });

  it("follows an obstacle from 3 m to 0.5 m: active after 3 updates, one near-miss, no flicker", () => {
    const engine = new HazardEngine();
    const box = grid([-0.25, 0.25], [0, 1], [-3, -3]);
    const ids = new Set<string>();
    const events: string[] = [];
    for (let i = 0; i <= 30; i++) {
      const z = -(2.5 * i) / 30;
      const result = engine.update(at(z, [...floor(z, 0.3, -z + 2.95), ...box], i * 100));
      events.push(...result.events.map((e) => e.type));
      if (i < 2) {
        expect(result.hazards).toEqual([]);
        continue;
      }
      expect(result.hazards).toHaveLength(1);
      ids.add(result.hazards[0].id);
      if (result.events.some((e) => e.type === "near_miss")) expect(result.hazards[0].distance).toBeLessThan(1);
    }
    expect(ids.size).toBe(1);
    expect(events).toEqual(["hazard_seen", "near_miss"]);
  });

  it("stays quiet under an open doorway with a header at 2.03 m", () => {
    const wall = [
      ...grid([-1.5, -0.5], [0, 2.5], [-2, -2], 0.1),
      ...grid([0.5, 1.5], [0, 2.5], [-2, -2], 0.1),
      ...grid([-0.5, 0.5], [2.03, 2.5], [-2, -2], 0.05),
    ];
    expect(settle(new HazardEngine(), [...floor(0), ...wall]).hazards).toEqual([]);
  });

  it("stays quiet on a ramp rising 8%", () => {
    expect(settle(new HazardEngine(), floor(0, 0.3, 3.5, (a) => 0.08 * a)).hazards).toEqual([]);
  });

  it("keeps sounding a low box that leaves the bottom of the view, until it is passed", () => {
    const engine = new HazardEngine();
    // 0.4 m tall, wide and deep, its front 3 m ahead of the start.
    const box = [
      ...grid([-0.2, 0.2], [0, 0.4], [-3, -3], 0.04),
      ...grid([-0.2, 0.2], [0.4, 0.4], [-3.4, -3], 0.04),
    ];
    let wasActive = false;
    for (let i = 0; i <= 36; i++) {
      const z = -i / 10;
      const update = at(z, [], i * 100);
      update.points = Float32Array.from(visible([...floor(z), ...box], update));
      const result = engine.update(update);
      const front = z + 3;
      if (result.hazards.length > 0) wasActive = true;
      if (wasActive && front > 0.1) {
        expect(result.hazards).toHaveLength(1);
        expect(Math.abs(result.hazards[0].distance - front)).toBeLessThan(0.15);
      }
      if (front < -0.5) expect(result.hazards).toEqual([]);
    }
    expect(wasActive).toBe(true);
  });
});

describe("HazardEngine behaviour", () => {
  it("never counts walking up to a wall as a near-miss", () => {
    const engine = new HazardEngine();
    const wall = grid([-1, 1], [0, 2], [-3, -3], 0.1);
    const events: string[] = [];
    for (let i = 0; i <= 25; i++) {
      const z = -i / 10;
      events.push(...engine.update(at(z, [...floor(z, 0.3, -z + 2.95), ...wall], i * 100)).events.map((e) => e.type));
    }
    expect(events).toEqual(["hazard_seen"]);
  });

  it("holds every hazard while tracking is lost, then carries on with the same one", () => {
    const engine = new HazardEngine();
    const scene = [...floor(0, 0.3, 1.45), ...grid([-0.2, 0.2], [0, 1], [-1.5, -1.5])];
    const before = settle(engine, scene).hazards;
    expect(before).toHaveLength(1);
    for (let i = 0; i < 10; i++) {
      expect(engine.update({ ...at(0, [], 400 + i * 100), tracking: false }).hazards).toEqual([]);
    }
    const after = engine.update(at(0, scene, 1500)).hazards;
    expect(after.map((h) => h.id)).toEqual(before.map((h) => h.id));
  });

  it("puts a drop-off first, then head height, then the nearest obstacle", () => {
    const scene = [
      ...floor(0, 0.3, 2.0),
      ...floor(0, 2.3, 3.5, () => -0.3),
      ...grid([-0.4, -0.2], [0, 1], [-1.2, -1.2]),
      ...grid([0.2, 0.4], [1.6, 1.8], [-1.6, -1.6]),
    ];
    const kinds = settle(new HazardEngine(), scene).hazards.map((h) => h.kind);
    expect(kinds).toEqual(["drop_off", "head_height", "obstacle"]);
  });

  it("uses the detector's label, which moves a person below a pole", () => {
    expect(priorityOf({ kind: "obstacle", label: "person", blocking: 0.2 })).toBe(5);
    expect(priorityOf({ kind: "obstacle", label: "pole_like", blocking: 0.2 })).toBe(4);
    expect(priorityOf({ kind: "obstacle", label: "bicycle", blocking: 0.2 })).toBe(3);
    expect(priorityOf({ kind: "obstacle", label: "unknown", blocking: 0.8 })).toBe(3);
    const engine = new HazardEngine();
    const scene = [...floor(0, 0.3, 1.45), ...grid([-0.2, 0.2], [0, 1.7], [-1.5, -1.5])];
    let result: EngineResult | null = null;
    for (let i = 0; i < 4; i++) result = engine.update(at(0, scene, i * 100), () => "person");
    expect(result!.hazards[0].label).toBe("person");
  });

  it("lowers the head-height top for a shorter user", () => {
    // A sign bottom at 1.75 m: under a 1.85 m user's top (1.95 m), over a 1.6 m user's (1.7 m).
    const sign = grid([-0.3, 0.3], [1.75, 1.9], [-1.8, -1.8]);
    expect(settle(new HazardEngine(1.85), [...floor(0), ...sign]).hazards).toHaveLength(1);
    expect(settle(new HazardEngine(1.6), [...floor(0), ...sign]).hazards).toEqual([]);
  });
});
