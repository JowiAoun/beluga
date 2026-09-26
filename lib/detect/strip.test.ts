import { describe, expect, it } from "vitest";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { SmallImage } from "@/lib/xr/cameraImage";
import { makeUpdate, perspective, yaw } from "@/lib/xr/testFixtures";
import { findStrip, StripTracker, stripHazard, withStrip } from "./strip";

const W = 320;
const H = 240;

// A grey floor, with rectangles painted on it: [left, top, right, bottom) in pixels.
function frame(...paint: Array<{ rect: [number, number, number, number]; rgb: [number, number, number] }>): SmallImage {
  const data = new Uint8ClampedArray(W * H * 4).fill(128);
  for (const { rect, rgb } of paint) {
    const [left, top, right, bottom] = rect;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) data.set([...rgb, 255], (y * W + x) * 4);
    }
  }
  return { width: W, height: H, data };
}

const SAFETY_YELLOW: [number, number, number] = [250, 205, 20];

function hazard(kind: HazardUpdate["kind"], distance: number, id: string = kind): HazardUpdate {
  return { id, kind, distance, angle: 0, label: "unknown", blocking: 0.5, active: true, firstSeenAt: 0, updatedAt: 0 };
}

describe("yellow strip", () => {
  it("finds a wide band low in the frame and gives its near side", () => {
    const sighting = findStrip(frame({ rect: [20, 190, 300, 206], rgb: SAFETY_YELLOW }));
    expect(sighting).not.toBeNull();
    expect(sighting!.u).toBeCloseTo(0.5, 1);
    expect(sighting!.near).toBeCloseTo(206 / H, 3);
    expect(sighting!.width).toBeCloseTo(280 / W, 2);
  });

  it("ignores a small yellow thing, a pole, a band high up and colours that aren't yellow", () => {
    expect(findStrip(frame({ rect: [100, 190, 160, 220], rgb: SAFETY_YELLOW }))).toBeNull();
    expect(findStrip(frame({ rect: [150, 0, 170, H], rgb: SAFETY_YELLOW }))).toBeNull();
    expect(findStrip(frame({ rect: [20, 50, 300, 80], rgb: SAFETY_YELLOW }))).toBeNull();
    expect(findStrip(frame({ rect: [20, 190, 300, 206], rgb: [255, 140, 0] }))).toBeNull();
    expect(findStrip(frame({ rect: [20, 190, 300, 206], rgb: [100, 90, 0] }))).toBeNull();
    expect(findStrip(frame({ rect: [20, 190, 300, 206], rgb: [240, 240, 240] }))).toBeNull();
  });

  it("warns only after three frames in a row", () => {
    const tracker = new StripTracker();
    const seen = findStrip(frame({ rect: [20, 190, 300, 206], rgb: SAFETY_YELLOW }));
    tracker.update(seen);
    tracker.update(seen);
    expect(tracker.active()).toBeNull();
    tracker.update(seen);
    expect(tracker.active()).toBe(seen);
    tracker.update(null);
    tracker.update(seen);
    expect(tracker.active()).toBeNull();
  });

  it("puts the band's near side on the floor", () => {
    // A level phone 1.3 m up with a 74° tall view sees the floor 2 m ahead at this row.
    const near = 0.5 + 1.3 / 2 / Math.tan((37 * Math.PI) / 180) / 2;
    const update = makeUpdate([], {
      t: 500,
      worldFromView: yaw(0, 0, 1.3, 0),
      viewFromWorld: yaw(0, 0, -1.3, 0),
      projection: perspective(40, 74),
      fov: { horizontal: 40, vertical: 74 },
    });
    const strip = stripHazard({ share: 0.1, u: 0.5, near, width: 0.9 }, update, 100);
    expect(strip).toMatchObject({ id: "strip", kind: "drop_off", firstSeenAt: 100, updatedAt: 500 });
    expect(strip!.distance).toBeCloseTo(2, 2);
    expect(strip!.angle).toBeCloseTo(0, 3);
  });

  it("stays quiet where depth already found the drop-off, and goes first otherwise", () => {
    const strip = hazard("drop_off", 2, "strip");
    const depthDrop = [hazard("drop_off", 2.3), hazard("obstacle", 1.2)];
    expect(withStrip(depthDrop, strip)).toBe(depthDrop);
    const farDrop = [hazard("drop_off", 3.3), hazard("obstacle", 1.2)];
    expect(withStrip(farDrop, strip).map((h) => h.id)).toEqual(["strip", "drop_off", "obstacle"]);
    expect(withStrip([hazard("obstacle", 1)], null).map((h) => h.id)).toEqual(["obstacle"]);
  });
});
