import { describe, expect, it } from "vitest";
import { spotOf } from "@/lib/hazard/cameraOnly";
import { cameraFov, poseFromTilt } from "./cameraSession";
import { forwardOf, toViewCoords } from "./geometry";
import { perspectiveFor } from "./projection";
import { makeUpdate } from "./testFixtures";

// Multiplies two column-major 4 × 4 matrices.
function times(a: Float32Array, b: Float32Array): number[] {
  const out: number[] = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out.push(sum);
    }
  }
  return out;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function expectClose(actual: ArrayLike<number>, expected: number[]) {
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));
}

describe("camera mode pose", () => {
  it("puts an upright phone at chest height, looking level along -z", () => {
    const { worldFromView, viewFromWorld } = poseFromTilt({ alpha: 0, beta: 90, gamma: 0 }, 0, 1.3);
    expectClose(worldFromView, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1.3, 0, 1]);
    expectClose(times(viewFromWorld, worldFromView), IDENTITY);
  });

  it("looks down when the phone leans back, and turns left as alpha grows", () => {
    const leaning = forwardOf(poseFromTilt({ alpha: 0, beta: 60, gamma: 0 }, 0, 1.3).worldFromView);
    expect(leaning.y).toBeCloseTo(-0.5, 5);
    expect(leaning.z).toBeCloseTo(-Math.sqrt(3) / 2, 5);
    const turned = forwardOf(poseFromTilt({ alpha: 90, beta: 90, gamma: 0 }, 0, 1.3).worldFromView);
    expect(turned.x).toBeCloseTo(-1, 5);
    expect(turned.z).toBeCloseTo(0, 5);
  });

  it("keeps the camera's direction when the page turns, and stays a clean rotation", () => {
    const tilt = { alpha: 20, beta: 75, gamma: 10 };
    const portrait = poseFromTilt(tilt, 0, 1.3);
    const landscape = poseFromTilt(tilt, 90, 1.3);
    const a = forwardOf(portrait.worldFromView);
    const b = forwardOf(landscape.worldFromView);
    expect(b.x).toBeCloseTo(a.x, 5);
    expect(b.y).toBeCloseTo(a.y, 5);
    expect(b.z).toBeCloseTo(a.z, 5);
    expectClose(times(landscape.viewFromWorld, landscape.worldFromView), IDENTITY);
  });

  it("reads the camera's view from the picture's shape", () => {
    const portrait = cameraFov(720, 1280);
    expect(portrait.vertical).toBe(67);
    expect(portrait.horizontal).toBeCloseTo(40.8, 1);
    expect(cameraFov(1280, 720)).toEqual({ horizontal: portrait.vertical, vertical: portrait.horizontal });
  });

  it("lets camera-only mode put a chair on the floor 2 m ahead", () => {
    const heightM = 1.33;
    const fov = cameraFov(720, 1280);
    const { worldFromView, viewFromWorld } = poseFromTilt({ alpha: 0, beta: 80, gamma: 0 }, 0, heightM);
    const update = makeUpdate([], {
      camera: { x: 0, y: heightM, z: 0 },
      worldFromView,
      viewFromWorld,
      projection: perspectiveFor(fov.horizontal, fov.vertical),
      fov,
      floorY: 0,
    });
    // Where the chair's feet and top edges show in this view, found the other way round.
    const at = (x: number, y: number, z: number) => toViewCoords({ x, y, z }, viewFromWorld, update.projection)!;
    const left = at(-0.2, 0, -2);
    const right = at(0.2, 0, -2);
    const top = at(0, 0.9, -2);
    const spot = spotOf(
      { label: "chair", score: 0.8, box: { left: left.u, right: right.u, top: top.v, bottom: left.v }, angle: 0 },
      update,
    );
    expect(spot?.ahead).toBeCloseTo(2, 2);
    expect(spot?.lateral).toBeCloseTo(0, 2);
  });
});
