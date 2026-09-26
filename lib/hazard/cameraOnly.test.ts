import { describe, expect, it } from "vitest";
import type { Detection } from "@/lib/detect/detections";
import type { DetectorClass } from "@/lib/shared/enums";
import { makeUpdate, perspective, yaw } from "@/lib/xr/testFixtures";
import { CameraOnlyEngine, spotOf } from "./cameraOnly";

// A level phone 1.3 m above the floor with the Galaxy S22's portrait view, walking along -z.
const HALF_V = Math.tan((37 * Math.PI) / 180);
const HALF_H = Math.tan((20 * Math.PI) / 180);

function view(t = 0, z = 0) {
  return makeUpdate([], {
    t,
    camera: { x: 0, y: 1.3, z },
    worldFromView: yaw(0, 0, 1.3, z),
    viewFromWorld: yaw(0, 0, -1.3, -z),
    projection: perspective(40, 74),
    fov: { horizontal: 40, vertical: 74 },
  });
}

// The image row of a point `drop` metres below the camera, `ahead` metres in front.
function row(ahead: number, drop: number): number {
  return 0.5 + drop / ahead / HALF_V / 2;
}

// The image column of a point `lateral` metres to the right, `ahead` metres in front.
function column(ahead: number, lateral: number): number {
  return 0.5 + lateral / ahead / HALF_H / 2;
}

function box(label: DetectorClass, left: number, right: number, top: number, bottom: number): Detection {
  return { label, score: 0.8, box: { left, right, top, bottom }, angle: 0 };
}

describe("camera-only spots", () => {
  it("puts a chair's bottom edge on the floor", () => {
    const chair = box("chair", column(2, -0.2), column(2, 0.2), 0.6, row(2, 1.3));
    const spot = spotOf(chair, view());
    expect(spot?.ahead).toBeCloseTo(2, 2);
    expect(spot?.lateral).toBeCloseTo(0, 2);
    expect(spot?.blocking).toBeCloseTo(0.4 / 0.9, 2);
  });

  it("leaves out a box beside the corridor", () => {
    const bench = box("bench", column(2, 0.6), column(2, 0.9), 0.7, row(2, 1.3));
    expect(spotOf(bench, view())).toBeNull();
  });

  it("sounds from the part of a wide box inside the corridor", () => {
    const bench = box("bench", column(2, -1.2), column(2, 0.15), 0.7, row(2, 1.3));
    const spot = spotOf(bench, view());
    expect(spot?.lateral).toBeCloseTo(-0.15, 2);
  });

  it("uses a person's head when the frame cuts off their feet", () => {
    const person = box("person", column(1.5, -0.25), column(1.5, 0.25), row(1.5, -0.4), 1);
    expect(spotOf(person, view())?.ahead).toBeCloseTo(1.5, 2);
  });

  it("uses a chair's top and usual height when the frame cuts off its legs", () => {
    const chair = box("chair", column(1.2, -0.2), column(1.2, 0.2), row(1.2, 0.4), 1);
    expect(spotOf(chair, view())?.ahead).toBeCloseTo(1.2, 2);
  });

  it("never puts a cut-off box farther than the frame's reach", () => {
    const chair = box("chair", 0.4, 0.6, 0.5, 1);
    expect(spotOf(chair, view())?.ahead).toBeCloseTo(1.3 / HALF_V, 2);
  });

  it("can't place a box whose bottom is above the horizon", () => {
    expect(spotOf(box("chair", 0.4, 0.6, 0.1, 0.4), view())).toBeNull();
  });
});

describe("camera-only engine", () => {
  // A 0.9 m chair; up close the frame cuts off its legs.
  const chairAt = (ahead: number) => [
    box("chair", column(ahead, -0.2), column(ahead, 0.2), row(ahead, 0.4), Math.min(1, row(ahead, 1.3))),
  ];

  it("sounds after two boxes in a row and closes in as the walker moves", () => {
    const engine = new CameraOnlyEngine();
    expect(engine.update(view(0), chairAt(2.5)).hazards).toHaveLength(0);
    const boxes = chairAt(2.5);
    const second = engine.update(view(250), boxes);
    expect(second.hazards).toHaveLength(1);
    expect(second.hazards[0]).toMatchObject({ kind: "obstacle", label: "chair" });
    expect(second.events.map((e) => e.type)).toEqual(["hazard_seen"]);
    // No new box, but the walker moved 0.5 m closer.
    const moved = engine.update(view(350, -0.5), boxes);
    expect(moved.hazards[0].distance).toBeCloseTo(2, 2);
  });

  it("goes quiet a second after the last box", () => {
    const engine = new CameraOnlyEngine();
    engine.update(view(0), chairAt(2));
    engine.update(view(250), chairAt(2));
    const same = chairAt(2);
    expect(engine.update(view(500), same).hazards).toHaveLength(1);
    expect(engine.update(view(1400), same).hazards).toHaveLength(1);
    expect(engine.update(view(1600), same).hazards).toHaveLength(0);
  });

  it("drops a first box that isn't seen again", () => {
    const engine = new CameraOnlyEngine();
    engine.update(view(0), chairAt(2));
    engine.update(view(250), []);
    expect(engine.update(view(500), chairAt(2)).hazards).toHaveLength(0);
  });

  it("sends one near-miss under a metre", () => {
    const engine = new CameraOnlyEngine();
    engine.update(view(0), chairAt(1.2));
    engine.update(view(250), chairAt(1.2));
    // Positions are smoothed, so 0.7 m after 1.2 m lands at 0.95 m.
    const close = engine.update(view(500), chairAt(0.7));
    expect(close.events.map((e) => e.type)).toEqual(["near_miss"]);
    expect(engine.update(view(750), chairAt(0.6)).events).toHaveLength(0);
  });

  it("stays silent while tracking is lost", () => {
    const engine = new CameraOnlyEngine();
    engine.update(view(0), chairAt(2));
    engine.update(view(250), chairAt(2));
    expect(engine.update({ ...view(300), tracking: false }, chairAt(2)).hazards).toHaveLength(0);
  });
});
