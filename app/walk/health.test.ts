import { describe, expect, it } from "vitest";
import { HealthWatch, type HealthInput } from "./health";

// A walk where updates, depth and sound all last arrived at `at` milliseconds.
function input(now: number, at: Partial<Omit<HealthInput, "now">> = {}): HealthInput {
  return { now, lastUpdateAt: now, lastDepthAt: now, soundRunning: true, ...at };
}

describe("HealthWatch", () => {
  it("says nothing while updates, depth and sound keep coming", () => {
    const health = new HealthWatch();
    for (let now = 0; now < 10_000; now += 1000) expect(health.update(input(now))).toEqual({ problem: null, started: false });
  });

  it("flags frames that stop for 3 s, once, before the depth they also stop", () => {
    const health = new HealthWatch();
    const stopped = { lastUpdateAt: 1000, lastDepthAt: 1000 };
    expect(health.update(input(3500, stopped)).problem).toBeNull();
    expect(health.update(input(4500, stopped))).toEqual({ problem: "frames", started: true });
    expect(health.update(input(5500, stopped))).toEqual({ problem: "frames", started: false });
    expect(health.counts.frames).toBe(1);
  });

  it("flags depth missing for 3 s while updates still come", () => {
    const health = new HealthWatch();
    expect(health.update(input(4500, { lastDepthAt: 1000 })).problem).toBe("depth");
  });

  it("flags sound paused for 2 s, and counts a problem each time it comes back", () => {
    const health = new HealthWatch();
    const paused = (now: number) => health.update(input(now, { soundRunning: false })).problem;
    expect(paused(0)).toBeNull();
    expect(paused(2500)).toBe("sound");
    expect(health.update(input(3000)).problem).toBeNull();
    expect(paused(4000)).toBeNull();
    expect(paused(6500)).toBe("sound");
    expect(health.counts.sound).toBe(2);
  });
});
