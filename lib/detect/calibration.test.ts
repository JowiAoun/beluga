import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ detect: vi.fn(() => []) }));
vi.mock("./detector", () => ({ Detector: { create: async () => ({ delegate: "CPU", detect: mocks.detect }) } }));
import { DetectPipeline } from "./pipeline";
import type { DetectorSink, SensingSession } from "@/lib/xr/session";
import { makeUpdate } from "@/lib/xr/testFixtures";

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("detector calibration gate", () => {
  it("does not analyse camera frames until enabled, and stops again when calibration is lost", async () => {
    vi.useFakeTimers();
    const pipeline = new DetectPipeline();
    await pipeline.load("CPU");
    let sink: DetectorSink = () => {};
    const detach = pipeline.attach({ onDetectorFrame: (callback: DetectorSink) => { sink = callback; return () => {}; } } as SensingSession);
    pipeline.labelFor(makeUpdate([]));
    const frame = { width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 0, 255]) };
    sink(frame, 100);
    await vi.runAllTimersAsync();
    expect(mocks.detect).not.toHaveBeenCalled();
    expect(pipeline.stats().brightness).toBeNull();
    pipeline.setEnabled(true, 200);
    sink(frame, 200);
    await vi.runAllTimersAsync();
    expect(mocks.detect).toHaveBeenCalledOnce();
    // A scheduled detector call must also be cancelled if readiness is withdrawn.
    sink(frame, 300);
    pipeline.setEnabled(false, 301);
    await vi.runAllTimersAsync();
    expect(mocks.detect).toHaveBeenCalledOnce();
    expect(pipeline.latestDetections()).toEqual([]);
    detach();
  });
});
