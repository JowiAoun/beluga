import { describe, expect, it, vi } from "vitest";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { HapticEngine, vibrationPattern } from "./engine";

const settings = { vibrationOn: true, vibrationStrength: "medium" as const };
const hazard = (kind: HazardUpdate["kind"] = "obstacle", distance = 2): HazardUpdate => ({
  id: kind, kind, distance, angle: 0, label: "unknown", blocking: 0.2, active: true, firstSeenAt: 0, updatedAt: 0,
});

describe("tactile hazard warnings", () => {
  it("stays quiet until ready and cancels immediately when readiness is lost", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.update([hazard()], false, 0);
    expect(vibrate).not.toHaveBeenCalled();
    engine.update([hazard()], true, 100);
    expect(vibrate).toHaveBeenLastCalledWith([70]);
    engine.update([hazard()], false, 150);
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
  it("does not restart pulses on every sensing update", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    for (let t = 0; t < 1000; t += 100) engine.update([hazard("obstacle", 3)], true, t);
    expect(vibrate).toHaveBeenCalledOnce();
    engine.update([hazard("obstacle", 3)], true, 1500);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
  it("repeats faster at close distance and gives each pattern a rest", () => {
    const near = vi.fn(() => true), far = vi.fn(() => true);
    const nearEngine = new HapticEngine(settings, near), farEngine = new HapticEngine(settings, far);
    for (let t = 0; t < 1500; t += 100) {
      nearEngine.update([hazard("obstacle", 0.5)], true, t);
      farEngine.update([hazard("obstacle", 3)], true, t);
    }
    expect(near.mock.calls.length).toBeGreaterThan(far.mock.calls.length);
  });
  it("prioritizes a drop-off over a closer obstacle and interrupts lower priority", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.update([hazard("obstacle", 0.5)], true, 0);
    engine.update([hazard("obstacle", 0.5), hazard("drop_off", 2)], true, 100);
    expect(vibrate).toHaveBeenLastCalledWith([70, 100, 70, 100, 70]);
    engine.update([hazard("obstacle", 0.5)], true, 200);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
  it("off cancels the active pattern and disables the calibration cue", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.update([hazard()], true, 0);
    engine.configure({ ...settings, vibrationOn: false });
    expect(vibrate).toHaveBeenLastCalledWith(0);
    vibrate.mockClear();
    engine.calibrated(100);
    engine.update([hazard()], true, 200);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("plays calibration once without the first hazard cutting its pattern off", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.calibrated(0);
    engine.update([hazard()], true, 100);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith([45, 180, 45]);
    engine.update([hazard()], true, 500);
    expect(vibrate).toHaveBeenLastCalledWith([70]);
  });
  it("cancels when there are no hazards or the walk stops", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.update([hazard()], true, 0); engine.update([], true, 100);
    expect(vibrate).toHaveBeenLastCalledWith(0);
    engine.update([hazard()], true, 200); engine.stop();
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
  it("uses different pulse lengths for light, medium and strong", () => {
    expect(vibrationPattern("head_height", "light")).toEqual([35, 100, 35]);
    expect(vibrationPattern("head_height", "medium")).toEqual([70, 100, 70]);
    expect(vibrationPattern("head_height", "strong")).toEqual([120, 100, 120]);
  });
  it("ignores inactive, distant and invalid hazards", () => {
    const vibrate = vi.fn(() => true);
    const engine = new HapticEngine(settings, vibrate);
    engine.update([{ ...hazard(), active: false }, hazard("obstacle", Infinity), hazard("obstacle", 4)], true, 0);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
