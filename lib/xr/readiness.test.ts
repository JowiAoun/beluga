import { describe, expect, it } from "vitest";
import { detectionReady } from "./readiness";

describe("walk readiness", () => {
  it("only unlocks depth detection after calibration succeeds", () => {
    expect(detectionReady(null)).toBe(false);
    for (const floorSource of ["guess", "hit_test"] as const) {
      expect(detectionReady({ tracking: true, calibrating: false, floorSource })).toBe(false);
      expect(detectionReady({ tracking: true, calibrating: false, floorSource }, false, true)).toBe(false);
    }
    expect(detectionReady({ tracking: true, calibrating: true, floorSource: "calibrated" })).toBe(false);
    expect(detectionReady({ tracking: true, calibrating: false, floorSource: "calibrated" })).toBe(true);
  });
  it("camera-only estimates require explicit confirmation, even if depth is available", () => {
    expect(detectionReady({ tracking: true, calibrating: false, floorSource: "calibrated" }, true)).toBe(false);
    expect(detectionReady({ tracking: true, calibrating: false, floorSource: "guess" }, true, true)).toBe(true);
    expect(detectionReady({ tracking: false, calibrating: false, floorSource: "guess" }, true, true)).toBe(false);
  });
});
