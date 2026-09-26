import { describe, expect, it } from "vitest";
import { SENSING } from "@/lib/shared/params";
import { TrackingMonitor } from "./tracking";

describe("TrackingMonitor", () => {
  it("calls tracking lost only after a full second without a good pose", () => {
    const monitor = new TrackingMonitor();
    expect(monitor.update(0, true).change).toBeNull();
    expect(monitor.update(100, false).change).toBeNull();
    expect(monitor.update(100 + SENSING.trackingLostMs, false).change).toBeNull();
    expect(monitor.update(150 + SENSING.trackingLostMs, false)).toEqual({ change: "lost", cue: true });
    expect(monitor.lost).toBe(true);
    expect(monitor.update(1500, false).change).toBeNull();
    expect(monitor.update(1600, true)).toEqual({ change: "regained", cue: false });
  });

  it("says hold steady at most once per cooldown", () => {
    const monitor = new TrackingMonitor();
    const loseAt = (t: number) => {
      monitor.update(t, false);
      const step = monitor.update(t + 1100, false);
      monitor.update(t + 1200, true);
      return step;
    };
    expect(loseAt(0).cue).toBe(true);
    expect(loseAt(3000).cue).toBe(false);
    expect(loseAt(1100 + SENSING.holdSteadyCooldownMs).cue).toBe(true);
  });
});
