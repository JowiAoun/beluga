import { describe, expect, it } from "vitest";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { SOUND_IDS, type SoundId } from "@/lib/shared/enums";
import { QUIET, Scheduler, type Action, type Scene, type SoundInfo } from "./scheduler";
import { soundFor, wordFor } from "./sounds";

// Durations of the temporary tones. Only the three closest-band sounds have loops.
const INFO = Object.fromEntries(
  SOUND_IDS.map((id) => [
    id,
    { durationS: id === "tick" ? 0.06 : 0.25, hasLoop: id === "edge_pulse" || id === "head_chime" || id === "tick" },
  ]),
) as Record<SoundId, SoundInfo>;

// A hazard `distance` ahead and `lateral` metres to the side of the walking line.
function hazard(id: string, distance: number, lateral = 0, extra: Partial<HazardUpdate> = {}): HazardUpdate {
  return {
    id,
    kind: "obstacle",
    distance,
    angle: (Math.atan2(lateral, distance) * 180) / Math.PI,
    label: "unknown",
    blocking: 0.2,
    active: true,
    firstSeenAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function scene(hazards: HazardUpdate[], extra: Partial<Scene> = {}): Scene {
  return { ...QUIET, hazards, speed: 1, ...extra };
}

// Ticks every 25 ms from `from` to `to` seconds with the same scene, and collects the actions.
function run(s: Scheduler, from: number, to: number, sc: Scene): Action[] {
  const actions: Action[] = [];
  for (let t = from; t < to - 1e-9; t += 0.025) actions.push(...s.tick(t, sc));
  return actions;
}

function hitTimes(actions: Action[], id?: string): number[] {
  return actions.flatMap((a) => (a.type === "hit" && (!id || a.id === id) ? [a.at] : []));
}

describe("Scheduler", () => {
  it("stays silent past 3 m, but a drop-off already sounds at 3.2 m", () => {
    expect(run(new Scheduler(INFO), 0, 1, scene([hazard("a", 3.2)]))).toEqual([]);
    const drop = run(new Scheduler(INFO), 0, 1, scene([hazard("d", 3.2, 0, { kind: "drop_off" })]));
    expect(hitTimes(drop).length).toBeGreaterThan(0);
  });

  it("repeats on the distance table: every 500 ms at 2.2 m, at -9 dB", () => {
    const actions = run(new Scheduler(INFO), 0, 2, scene([hazard("a", 2.2)]));
    const times = hitTimes(actions);
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeCloseTo(0.5, 6);
    expect(actions.find((a) => a.type === "voice")).toMatchObject({ gainDb: -9 });
  });

  it("brings the next repeat forward when the hazard comes closer", () => {
    const s = new Scheduler(INFO);
    run(s, 0, 0.1, scene([hazard("a", 2.8)]));
    // The 700 ms repeat was due at 0.7 s; at 0.9 m it is 120 ms after the last one.
    const closer = run(s, 0.1, 0.3, scene([hazard("a", 0.9)]));
    expect(hitTimes(closer)[0]).toBeCloseTo(0.12, 6);
  });

  it("switches a long sound to its loop in the closest band, and back to repeats after", () => {
    const s = new Scheduler(INFO);
    const near = run(s, 0, 0.5, scene([hazard("h", 0.4, 0, { kind: "head_height" })]));
    expect(near.filter((a) => a.type === "loop_start")).toHaveLength(1);
    expect(hitTimes(near)).toEqual([]);
    const back = run(s, 0.5, 1, scene([hazard("h", 0.8, 0, { kind: "head_height" })]));
    expect(back[1]).toMatchObject({ type: "loop_stop" });
    expect(hitTimes(back)[0]).toBeCloseTo(0.5, 6);
  });

  it("repeats a short tick every 80 ms in the closest band instead of looping", () => {
    const actions = run(new Scheduler(INFO), 0, 0.5, scene([hazard("a", 0.4)]));
    expect(actions.some((a) => a.type === "loop_start")).toBe(false);
    const times = hitTimes(actions);
    expect(times[1] - times[0]).toBeCloseTo(0.08, 6);
  });

  it("plays one hazard at a time: the nearest band first, then the most urgent kind", () => {
    const ids = (hazards: HazardUpdate[]) =>
      new Set(run(new Scheduler(INFO), 0, 0.2, scene(hazards)).flatMap((a) => (a.type === "voice" ? [a.id] : [])));
    const drop = (d: number) => hazard("drop", d, 0, { kind: "drop_off" });
    const pole = hazard("pole", 1.2, -0.2, { label: "pole_like" });
    // A drop-off at 2.2 m is a band further out than a pole at 1.2 m, even with its bands shifted.
    expect(ids([drop(2.2), pole, hazard("box", 1.4, 0.3)])).toEqual(new Set(["pole"]));
    // In the same band, the drop-off comes first.
    expect(ids([drop(1.6), pole])).toEqual(new Set(["drop"]));
  });

  it("keeps the hazard already sounding against a closer one in the same band, until it is a band nearer", () => {
    const s = new Scheduler(INFO);
    const voiced = (actions: Action[]) => actions.flatMap((a) => (a.type === "voice" ? [a.id] : []));
    expect(voiced(run(s, 0, 0.1, scene([hazard("a", 1.4, -0.3)])))).toEqual(["a", "a", "a", "a"]);
    const same = run(s, 0.1, 0.3, scene([hazard("b", 1.1, 0.3), hazard("a", 1.4, -0.3)]));
    expect(new Set(voiced(same))).toEqual(new Set(["a"]));
    const nearer = run(s, 0.3, 0.4, scene([hazard("b", 0.9, 0.3), hazard("a", 1.3, -0.3)]));
    expect(nearer[0]).toEqual({ type: "end", id: "a" });
    expect(new Set(voiced(nearer))).toEqual(new Set(["b"]));
  });

  it("lets a drop-off duck a second hazard by 12 dB when two can play", () => {
    const hazards = [hazard("drop", 1.6, 0, { kind: "drop_off" }), hazard("pole", 1.2, -0.2, { label: "pole_like" })];
    const voices = run(new Scheduler(INFO, 2), 0, 0.2, scene(hazards)).filter((a) => a.type === "voice");
    expect(voices.find((v) => v.id === "pole")).toMatchObject({ gainDb: -3 - 12 });
    expect(voices.find((v) => v.id === "drop")).toMatchObject({ gainDb: -3 });
  });

  it("drops an obstacle 6 dB when standing still, then stops it after 3 repeats until moving", () => {
    const s = new Scheduler(INFO);
    const still = run(s, 0, 3, scene([hazard("a", 1.2)], { stationary: true }));
    expect(hitTimes(still)).toHaveLength(3);
    expect(still.find((a) => a.type === "voice")).toMatchObject({ gainDb: -3 - 6 });
    const moving = run(s, 3, 3.1, scene([hazard("a", 1.2)]));
    expect(hitTimes(moving)[0]).toBe(3);
  });

  it("never quietens a drop-off for standing still", () => {
    const actions = run(new Scheduler(INFO), 0, 3, scene([hazard("d", 1.2, 0, { kind: "drop_off" })], { stationary: true }));
    expect(hitTimes(actions).length).toBeGreaterThan(10);
    // Drop-offs use the table shifted 0.5 m out, so 1.2 m is already in the 0 dB band.
    expect(actions.find((a) => a.type === "voice")).toMatchObject({ gainDb: 0 });
  });

  it("says the word and the side once, in the 1.5 to 2.0 m band, with an 8 s cooldown per word and side", () => {
    const s = new Scheduler(INFO);
    const pole = (id: string, d: number) => hazard(id, d, -0.3, { label: "pole_like" });
    const says = (actions: Action[]) => actions.filter((a) => a.type === "say");
    expect(says(run(s, 0, 0.5, scene([pole("p1", 2.4)])))).toEqual([]);
    expect(says(run(s, 0.5, 1, scene([pole("p1", 1.8)])))).toEqual([
      { type: "say", id: "p1", words: ["pole", "left"], pan: expect.closeTo(-0.667, 2) },
    ]);
    expect(says(run(s, 1, 1.5, scene([pole("p1", 1.6)])))).toEqual([]);
    // A second pole on the same side 3 s later stays quiet; one on the right speaks.
    expect(says(run(s, 4, 4.5, scene([pole("p2", 1.8)])))).toEqual([]);
    const right = says(run(s, 4.5, 5, scene([hazard("p3", 1.8, 0.3, { label: "pole_like" })])));
    expect(right.map((a) => a.type === "say" && a.words)).toEqual([["pole", "right"]]);
  });

  it("uses the distance the user will be at when Bluetooth plays it", () => {
    // 2.05 m is in the 2.0 to 2.5 m band, but 1.4 m/s × 0.25 s takes it to 1.7 m.
    const actions = run(new Scheduler(INFO), 0, 0.1, scene([hazard("a", 2.05)], { speed: 1.4, leadS: 0.25 }));
    expect(actions.find((a) => a.type === "voice")).toMatchObject({ gainDb: -6 });
  });

  it("marks the first hit straight ahead for the centre tick, then once a second", () => {
    const ahead = run(new Scheduler(INFO), 0, 0.1, scene([hazard("a", 1.2, 0.02)]));
    const side = run(new Scheduler(INFO), 0, 0.1, scene([hazard("a", 1.2, 0.3)]));
    expect(ahead.find((a) => a.type === "hit")).toMatchObject({ centre: true });
    expect(side.find((a) => a.type === "hit")).toMatchObject({ centre: false });
    // Every 220 ms for 2 s, with the marker at 0, 1.1 and 2.2 s at most.
    const hits = run(new Scheduler(INFO), 0, 2, scene([hazard("a", 1.2, 0.02)])).filter((a) => a.type === "hit");
    expect(hits.length).toBeGreaterThan(8);
    expect(hits.flatMap((a) => (a.type === "hit" && a.centre ? [a.at] : []))).toEqual([0, expect.closeTo(1.1, 6)]);
  });

  it("plays the one sound picked for every hazard, with no words and no centre tick", () => {
    const s = new Scheduler(INFO);
    s.setOneSound("ping");
    const hazards = [
      hazard("drop", 1.8, 0.02, { kind: "drop_off" }),
      hazard("pole", 1.8, 0.02, { label: "pole_like" }),
    ];
    const actions = run(s, 0, 1, scene(hazards));
    const hits = actions.filter((a) => a.type === "hit");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((a) => a.type === "hit" && a.sound === "ping" && !a.centre)).toBe(true);
    expect(actions.some((a) => a.type === "say")).toBe(false);
    s.setOneSound(null);
    expect(run(s, 1, 1.1, scene(hazards)).find((a) => a.type === "hit")).toMatchObject({ sound: "edge_pulse" });
  });

  it("ends a voice when its hazard goes, and every voice on clear", () => {
    const s = new Scheduler(INFO);
    run(s, 0, 0.2, scene([hazard("a", 0.4, 0, { kind: "head_height" }), hazard("b", 2)]));
    const gone = s.tick(0.2, scene([hazard("b", 2)]));
    expect(gone.slice(0, 2)).toEqual([
      { type: "loop_stop", id: "a", at: 0.2 },
      { type: "end", id: "a" },
    ]);
    expect(s.clear()).toEqual([{ type: "end", id: "b" }]);
    expect(s.snapshot()).toEqual([]);
  });
});

describe("sounds and words", () => {
  it("picks the sound by kind, then triage's blocked flag, then the detector label", () => {
    expect(soundFor({ kind: "drop_off", label: "unknown" }, true)).toBe("edge_pulse");
    expect(soundFor({ kind: "head_height", label: "unknown" })).toBe("head_chime");
    expect(soundFor({ kind: "obstacle", label: "bicycle" }, true)).toBe("taps");
    expect(soundFor({ kind: "obstacle", label: "bicycle" })).toBe("bell");
    expect(soundFor({ kind: "obstacle", label: "bus" })).toBe("buzz");
    expect(soundFor({ kind: "obstacle", label: "person" })).toBe("marimba");
    expect(soundFor({ kind: "obstacle", label: "pole_like" })).toBe("ping");
    expect(soundFor({ kind: "obstacle", label: "fire_hydrant" })).toBe("ping");
    expect(soundFor({ kind: "obstacle", label: "chair" })).toBe("tick");
    expect(soundFor({ kind: "obstacle", label: "unknown" })).toBe("tick");
  });

  it("names only what it can name", () => {
    expect(wordFor({ kind: "drop_off", label: "unknown" })).toBe("edge");
    expect(wordFor({ kind: "obstacle", label: "stop_sign" })).toBe("pole");
    expect(wordFor({ kind: "obstacle", label: "unknown" }, true)).toBe("blocked");
    expect(wordFor({ kind: "obstacle", label: "unknown" })).toBeNull();
    expect(wordFor({ kind: "obstacle", label: "person" })).toBeNull();
  });
});
