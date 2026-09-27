import { describe, expect, it } from "vitest";
import { poseFromTilt } from "./cameraSession";
import { fixFor, tiltOf, TiltWatch } from "./tilt";

// A column-major pose that turns `yaw` about up, then pitches the camera up by `pitch`, then turns
// the phone `roll` about the way it looks (positive lifts its right edge).
function pose(pitchDeg: number, rollDeg: number, yawDeg = 0): Float32Array {
  const [p, r, y] = [pitchDeg, rollDeg, yawDeg].map((d) => (d * Math.PI) / 180);
  const rx = [1, 0, 0, 0, Math.cos(p), Math.sin(p), 0, -Math.sin(p), Math.cos(p)];
  const ry = [Math.cos(y), 0, -Math.sin(y), 0, 1, 0, Math.sin(y), 0, Math.cos(y)];
  const rz = [Math.cos(r), Math.sin(r), 0, -Math.sin(r), Math.cos(r), 0, 0, 0, 1];
  // 3 × 3 column-major products.
  const mul = (a: number[], b: number[]) =>
    Array.from({ length: 9 }, (_, i) => {
      const col = Math.floor(i / 3);
      const row = i % 3;
      return a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2];
    });
  const m = mul(mul(ry, rx), rz);
  return Float32Array.of(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 1.3, 0, 1);
}

describe("tiltOf", () => {
  it("reads the pitch and the roll, whichever way the user faces", () => {
    for (const yaw of [0, 70, -140]) {
      const tilt = tiltOf(pose(-12, 8, yaw));
      expect(tilt.pitchDeg).toBeCloseTo(-12, 4);
      expect(tilt.rollDeg).toBeCloseTo(8, 4);
    }
  });

  it("reads camera mode's pose the same way", () => {
    // Upright in portrait, then the top tipped back 20° so the camera looks up.
    expect(tiltOf(poseFromTilt({ alpha: 0, beta: 90, gamma: 0 }, 0, 1.3).worldFromView).pitchDeg).toBeCloseTo(0, 4);
    expect(tiltOf(poseFromTilt({ alpha: 0, beta: 110, gamma: 0 }, 0, 1.3).worldFromView).pitchDeg).toBeCloseTo(20, 4);
  });
});

describe("fixFor", () => {
  it("asks to point lower, higher, or turn upright, turning first", () => {
    expect(fixFor({ pitchDeg: -10, rollDeg: 5 })).toBeNull();
    expect(fixFor({ pitchDeg: 15, rollDeg: 0 })).toBe("lower");
    expect(fixFor({ pitchDeg: -30, rollDeg: 0 })).toBe("higher");
    expect(fixFor({ pitchDeg: -30, rollDeg: 25 })).toBe("clockwise");
    expect(fixFor({ pitchDeg: 0, rollDeg: -25 })).toBe("counterclockwise");
  });
});

describe("TiltWatch", () => {
  it("shows a fix after a second past the limits, and clears it 5° back inside", () => {
    const watch = new TiltWatch();
    expect(watch.update(0, { pitchDeg: 15, rollDeg: 0 })).toBeNull();
    expect(watch.update(900, { pitchDeg: 15, rollDeg: 0 })).toBeNull();
    expect(watch.update(1000, { pitchDeg: 15, rollDeg: 0 })).toBe("lower");
    // Just inside the limit is not far enough back.
    expect(watch.update(1100, { pitchDeg: 8, rollDeg: 0 })).toBe("lower");
    expect(watch.update(1200, { pitchDeg: 4, rollDeg: 0 })).toBeNull();
  });

  it("never shows for a short sway", () => {
    const watch = new TiltWatch();
    for (let t = 0; t < 3000; t += 100) {
      const pitchDeg = t % 800 < 400 ? 15 : 0;
      expect(watch.update(t, { pitchDeg, rollDeg: 0 })).toBeNull();
    }
  });
});
