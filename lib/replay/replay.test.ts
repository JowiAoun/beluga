import { describe, expect, it } from "vitest";
import { HazardEngine } from "@/lib/hazard/engine";
import { makeUpdate, perspective, yaw } from "@/lib/xr/testFixtures";
import { decodeClip, encodeClip, REPLAY_VERSION } from "./format";
import { Recorder } from "./recorder";

// A wall 2 m ahead of a phone 1.3 m up, with floor in front of it.
function scene(t: number) {
  const points: number[] = [];
  for (let a = 0.4; a <= 1.95; a += 0.05) for (let x = -0.5; x <= 0.5; x += 0.1) points.push(x, 0, -a);
  for (let y = 0; y <= 2.5; y += 0.1) for (let x = -1; x <= 1; x += 0.1) points.push(x, y, -2);
  return makeUpdate(points, {
    t,
    camera: { x: 0, y: 1.3, z: 0 },
    worldFromView: yaw(0, 0, 1.3, 0),
    viewFromWorld: yaw(0, 0, -1.3, 0),
    projection: perspective(40, 74),
    fov: { horizontal: 40, vertical: 74 },
  });
}

describe("replay clips", () => {
  it("round-trips through the gzipped file to the millimetre", async () => {
    const recorder = new Recorder();
    for (let i = 0; i < 5; i++) recorder.add(scene(i * 100), []);
    const blob = await encodeClip(recorder.clip());
    const clip = await decodeClip(blob);
    expect(clip.version).toBe(REPLAY_VERSION);
    expect(clip.updates).toHaveLength(5);
    const before = scene(0).points;
    const after = clip.updates[0].points;
    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) expect(Math.abs(after[i] - before[i])).toBeLessThanOrEqual(0.0005);
    expect(Array.from(clip.updates[0].projection)).toEqual(Array.from(scene(0).projection));
  });

  it("gives the hazard engine the same answer as the live updates", async () => {
    const live = new HazardEngine();
    const replayed = new HazardEngine();
    const recorder = new Recorder();
    for (let i = 0; i < 4; i++) {
      live.update(scene(i * 100));
      recorder.add(scene(i * 100), []);
    }
    const clip = await decodeClip(await encodeClip(recorder.clip()));
    let last = null;
    for (const update of clip.updates) last = replayed.update(update);
    const expected = live.update(scene(400)).hazards;
    expect(expected).toHaveLength(1);
    expect(last!.hazards[0].distance).toBeCloseTo(expected[0].distance, 2);
    expect(last!.hazards[0].kind).toBe(expected[0].kind);
  });

  it("stops after 30 s and keeps detector results only when they change", () => {
    const recorder = new Recorder();
    const boxes = [{ label: "person" as const, score: 0.9, box: { left: 0.4, top: 0.2, right: 0.6, bottom: 0.9 }, angle: 0 }];
    expect(recorder.add(scene(0), boxes)).toBe(true);
    expect(recorder.add(scene(100), boxes)).toBe(true);
    expect(recorder.add(scene(31_000), [])).toBe(false);
    expect(recorder.clip().detections).toHaveLength(1);
    expect(recorder.seconds()).toBeCloseTo(0.1, 6);
  });
});
