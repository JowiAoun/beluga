import { describe, expect, it } from "vitest";
import type { LabelQuery } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { yaw } from "@/lib/xr/testFixtures";
import { meanBrightness, toDetection, toDetectorClass, type Detection } from "./detections";
import { FrameGate, TurnMeter, type GateInput } from "./gate";
import { LabelMatcher } from "./match";

const HFOV = 38;

function detection(
  label: Detection["label"],
  left: number,
  right: number,
  top = 0.3,
  bottom = 0.9,
  score = 0.6,
): Detection {
  return { label, score, box: { left, top, right, bottom }, angle: ((left + right) / 2 - 0.5) * HFOV };
}

function query(u: number | null, extra: Partial<LabelQuery> = {}): LabelQuery {
  return { id: "h1", kind: "obstacle", angle: 0, distance: 2, poleLike: false, u, ...extra };
}

describe("detections", () => {
  it("maps MediaPipe names onto the enum and drops the rest", () => {
    expect(toDetectorClass("fire hydrant")).toBe("fire_hydrant");
    expect(toDetectorClass("Potted Plant")).toBe("potted_plant");
    expect(toDetectorClass("traffic light")).toBe("unknown");
    expect(toDetection({ name: "dog", score: 0.9, x: 0, y: 0, width: 10, height: 10 }, 100, 100, HFOV)).toBeNull();
  });

  it("turns a pixel box into frame fractions and an angle", () => {
    const d = toDetection({ name: "bicycle", score: 0.7, x: 111, y: 160, width: 37, height: 160 }, 148, 320, HFOV)!;
    expect(d.box).toEqual({ left: 0.75, top: 0.5, right: 1, bottom: 1 });
    expect(d.angle).toBeCloseTo((0.875 - 0.5) * HFOV, 6);
  });

  it("measures brightness", () => {
    const grey = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(100) };
    expect(meanBrightness(grey)).toBeCloseTo(100, 6);
  });
});

describe("LabelMatcher", () => {
  it("takes the highest score within 10° of the hazard", () => {
    const m = new LabelMatcher();
    // 10° is 0.26 of a 38° view. The chair at 0.55 is closest in angle but scores lower.
    m.update(
      [
        detection("chair", 0.5, 0.6, 0.3, 0.9, 0.5),
        detection("bicycle", 0.45, 0.75, 0.3, 0.9, 0.8),
        detection("person", 0.9, 1),
      ],
      0,
    );
    expect(m.labelFor(query(0.55), 50, HFOV)).toBe("bicycle");
  });

  it("ignores boxes too far to the side, or at the wrong height", () => {
    const m = new LabelMatcher();
    m.update([detection("person", 0.85, 0.95)], 0);
    expect(m.labelFor(query(0.5), 50, HFOV)).toBeNull();
    // A box only in the top third can't be the obstacle, but can be a head-height sign.
    m.update([detection("stop_sign", 0.45, 0.55, 0.05, 0.3)], 100);
    expect(m.labelFor(query(0.5, { id: "o" }), 150, HFOV)).toBeNull();
    expect(m.labelFor(query(0.5, { id: "h", kind: "head_height" }), 150, HFOV)).toBe("stop_sign");
  });

  it("holds a label for a second after its box goes, then lets go", () => {
    const m = new LabelMatcher();
    m.update([detection("bicycle", 0.4, 0.6)], 0);
    expect(m.labelFor(query(0.5), 0, HFOV)).toBe("bicycle");
    m.update([], 250);
    expect(m.labelFor(query(0.5), 900, HFOV)).toBe("bicycle");
    expect(m.labelFor(query(0.5), 1100, HFOV)).toBeNull();
  });

  it("stops using detections that are over a second old", () => {
    const m = new LabelMatcher();
    m.update([detection("bicycle", 0.4, 0.6)], 0);
    expect(m.labelFor(query(0.5, { id: "late" }), 1500, HFOV)).toBeNull();
  });

  it("never labels drop-offs or hazards out of view", () => {
    const m = new LabelMatcher();
    m.update([detection("bicycle", 0.4, 0.6)], 0);
    expect(m.labelFor(query(0.5, { kind: "drop_off" }), 0, HFOV)).toBeNull();
    expect(m.labelFor(query(null), 0, HFOV)).toBeNull();
  });
});

function hazard(id: string, extra: Partial<HazardUpdate> = {}): HazardUpdate {
  return {
    id,
    kind: "obstacle",
    distance: 2.5,
    angle: 0,
    label: "unknown",
    blocking: 0.3,
    active: true,
    firstSeenAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function input(t: number, hazards: HazardUpdate[], extra: Partial<GateInput> = {}): GateInput {
  return { t, hazards, stationary: false, turnRateDegPerS: 0, brightness: 120, cell: "f244m6u", ...extra };
}

// Runs the gate every 100 ms and returns what fired.
function walk(gate: FrameGate, from: number, to: number, at: (t: number) => GateInput): string[] {
  const fired: string[] = [];
  for (let t = from; t <= to; t += 100) {
    const result = gate.update(at(t));
    if (result.fire) fired.push(`${result.fire.reason}@${t}`);
  }
  return fired;
}

describe("FrameGate", () => {
  it("sends a new obstacle once it has been active for 1 s, and only once", () => {
    const gate = new FrameGate();
    expect(walk(gate, 0, 5000, (t) => input(t, [hazard("a")]))).toEqual(["new_thing@1000"]);
  });

  it("waits 20 s before sending the same label on the same side again", () => {
    const gate = new FrameGate();
    // b is due at 11 s and waits for the cooldown; c comes too soon after b and never goes.
    const fired = walk(gate, 0, 30_000, (t) => input(t, [hazard(t < 10_000 ? "a" : t < 25_000 ? "b" : "c")]));
    expect(fired).toEqual(["new_thing@1000", "new_thing@21000"]);
  });

  it("sends a drop-off as soon as it is active, and a head-height hazard under 1.5 m", () => {
    const gate = new FrameGate();
    const drop = hazard("d", { kind: "drop_off" });
    expect(gate.update(input(0, [drop])).fire?.reason).toBe("drop_off");
    const head = (distance: number) => hazard("h", { kind: "head_height", distance });
    expect(walk(gate, 10_000, 12_000, (t) => input(t, [head(t < 11_000 ? 2 : 1.4)]))).toEqual(["head_height@11000"]);
  });

  it("sends a lasting obstacle when the user stops, or steers 15° around it", () => {
    const still = new FrameGate();
    // Past the new-thing send, standing still counts as lasting, 6 s later (the local budget).
    expect(walk(still, 0, 8000, (t) => input(t, [hazard("a")], { stationary: t >= 3000 }))).toEqual([
      "new_thing@1000",
      "lasting@7000",
    ]);
    const steer = new FrameGate();
    const around = (t: number) => hazard("a", { distance: 1.8, angle: t < 7000 ? 5 : 25 });
    expect(walk(steer, 0, 8000, (t) => input(t, [around(t)]))).toEqual(["new_thing@1000", "lasting@7000"]);
  });

  it("never sends people or cars", () => {
    const gate = new FrameGate();
    const result = walk(gate, 0, 3000, (t) =>
      input(t, [hazard("p", { label: "person" }), hazard("c", { label: "car" })]),
    );
    expect(result).toEqual([]);
    expect(gate.update(input(3100, [hazard("p", { label: "person" })])).skipped).toBeNull();
  });

  it("holds back while turning fast, in the dark, without frames or with a call out", () => {
    const cases: Array<[Partial<GateInput>, string]> = [
      [{ turnRateDegPerS: 90 }, "turning"],
      [{ brightness: 10 }, "dark"],
      [{ brightness: null }, "no_camera"],
    ];
    for (const [extra, reason] of cases) {
      const gate = new FrameGate();
      expect(gate.update(input(0, [hazard("d", { kind: "drop_off" })], extra)).skipped?.reason).toBe(reason);
      expect(gate.update(input(100, [hazard("d", { kind: "drop_off" })])).fire?.reason).toBe("drop_off");
    }
    const busy = new FrameGate();
    busy.setInFlight(true);
    expect(busy.update(input(0, [hazard("d", { kind: "drop_off" })])).skipped?.reason).toBe("in_flight");
  });

  it("keeps to one frame every 6 s and 150 an hour", () => {
    const gate = new FrameGate();
    let sent = 0;
    // A new drop-off every 100 ms for 20 minutes, each far enough apart in time to pass its cooldown.
    for (let t = 0; t <= 20 * 60_000; t += 100) {
      if (gate.update(input(t, [hazard(`d${t}`, { kind: "drop_off" })])).fire) sent++;
    }
    // The 30 s drop-off cooldown is the tighter limit here: one send per 30 s.
    expect(sent).toBe(41);
    const busy = new FrameGate();
    const fired = walk(busy, 0, 7000, (t) => input(t, [hazard("d", { kind: "drop_off" }), hazard("a")]));
    expect(fired).toEqual(["drop_off@0", "new_thing@6000"]);
  });
});

describe("TurnMeter", () => {
  it("measures degrees per second either way, across the ±180° seam", () => {
    const meter = new TurnMeter();
    meter.update(0, yaw(170, 0, 0, 0));
    expect(meter.update(500, yaw(-170, 0, 0, 0))).toBeCloseTo(40, 3);
    expect(meter.update(1000, yaw(-150, 0, 0, 0))).toBeCloseTo(40, 3);
  });
});
