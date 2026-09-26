import { describe, expect, it } from "vitest";
import { earDelays, earGains, lateralOf, panForAngle, panForLateral, sideOf } from "./placement";

describe("placement", () => {
  it("pans a pole 0.3 m left of the path the same from 3 m and from 1 m", () => {
    for (const distance of [3, 1]) {
      const angle = (Math.atan2(-0.3, distance) * 180) / Math.PI;
      const lateral = lateralOf({ distance, angle });
      expect(lateral).toBeCloseTo(-0.3, 6);
      expect(panForLateral(lateral)).toBeCloseTo(-0.3 / 0.45, 6);
      expect(sideOf(lateral)).toBe("left");
    }
  });

  it("calls the middle of the corridor ahead", () => {
    expect(sideOf(0.05)).toBe("ahead");
    expect(sideOf(-0.08)).toBe("ahead");
    expect(sideOf(0.2)).toBe("right");
  });

  it("clamps the pan past the corridor edge and for wide angles", () => {
    expect(panForLateral(-2)).toBe(-1);
    expect(panForAngle(35)).toBe(1);
    expect(panForAngle(-10)).toBeCloseTo(-0.5, 6);
  });

  it("plays full pan from one ear only", () => {
    expect(earGains(-1)).toEqual({ left: 1, right: 0 });
    expect(earGains(1)).toEqual({ left: 0, right: 1 });
  });

  it("keeps both ears level in the middle and cuts the far ear by 24 dB × pan", () => {
    expect(earGains(0)).toEqual({ left: 1, right: 1 });
    const half = earGains(0.5);
    expect(half.right).toBe(1);
    expect(20 * Math.log10(half.left)).toBeCloseTo(-12, 6);
  });

  it("delays the far ear by up to 0.6 ms", () => {
    expect(earDelays(-1)).toEqual({ left: 0, right: 0.0006 });
    expect(earDelays(0.5).left).toBeCloseTo(0.0003, 9);
    expect(earDelays(0)).toEqual({ left: 0, right: 0 });
  });
});
