import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { AUDIO } from "@/lib/shared/params";
import { AudioEngine } from "./engine";

// Just enough Web Audio for the engine to build its graph: parameters jump straight to the value
// they are set to, and every connection is recorded so a test can see where a sound goes.

class FakeParam {
  constructor(public value = 1) {}
  setTargetAtTime(value: number) {
    this.value = value;
  }
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {}
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  connect<T extends FakeNode>(node: T): T {
    this.outputs.push(node);
    return node;
  }
  disconnect() {}
}

class FakeGain extends FakeNode {
  readonly gain: FakeParam;
  constructor(_ctx: unknown, options: { gain?: number } = {}) {
    super();
    this.gain = new FakeParam(options.gain ?? 1);
  }
}

class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0);
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  readonly buffer: { duration: number };
  constructor(_ctx: unknown, options: { buffer: { duration: number } }) {
    super();
    this.buffer = options.buffer;
  }
  start() {}
  stop() {}
}

function fakeContext() {
  return {
    currentTime: 0,
    sampleRate: 8000,
    outputLatency: 0,
    baseLatency: 0,
    state: "running",
    destination: new FakeNode(),
    createBuffer(_channels: number, length: number, rate: number) {
      const data = new Float32Array(length);
      return {
        duration: length / rate,
        getChannelData: () => data,
        copyToChannel: (samples: Float32Array) => data.set(samples.subarray(0, length)),
      };
    },
  };
}

type Ctx = ReturnType<typeof fakeContext>;

function hazard(kind: HazardUpdate["kind"], distance: number): HazardUpdate {
  return {
    id: `${kind}-1`,
    kind,
    distance,
    angle: 0,
    label: "unknown",
    blocking: 0.2,
    active: true,
    firstSeenAt: 0,
    updatedAt: 0,
  };
}

const HALF = 10 ** (AUDIO.hazardUnderAnswerDb / 20);
const WALKING = { speed: 1, stationary: false };

let ctx: Ctx;
let engine: AudioEngine;

// The engine's private nodes, read through the index form TypeScript allows for tests.
const bus = () => (engine["hazardBus"] as unknown as FakeGain).gain.value;
const answerSource = () => (engine["answer"]?.playing.source as unknown as FakeSource | undefined) ?? null;

function answerBuffer(seconds = 2) {
  return ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate) as unknown as AudioBuffer;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("GainNode", FakeGain);
  vi.stubGlobal("DelayNode", FakeDelay);
  vi.stubGlobal("ChannelMergerNode", FakeNode);
  vi.stubGlobal("DynamicsCompressorNode", FakeNode);
  vi.stubGlobal("AudioBufferSourceNode", FakeSource);
  ctx = fakeContext();
  engine = new AudioEngine(ctx as unknown as AudioContext);
  engine.start();
});

afterEach(() => {
  engine.stop();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AudioEngine under an Ask answer", () => {
  it("halves obstacle warnings while the answer plays, and keeps the answer at full level", () => {
    engine.update([hazard("obstacle", 0.8)], WALKING);
    expect(bus()).toBe(1);

    expect(engine.playAnswer(answerBuffer(), 0)).toBe(true);
    expect(bus()).toBeCloseTo(HALF, 6);
    expect(bus()).toBeCloseTo(0.5, 2);
    const answerGain = engine["answer"]!.placer.input as unknown as FakeGain;
    expect(answerGain.gain.value).toBe(1);
  });

  it("sends warning repeats through the bus that gets turned down", () => {
    engine.update([hazard("obstacle", 0.8)], WALKING);
    const hazardBus = engine["hazardBus"] as unknown as FakeNode;
    const voices = engine["voices"] as unknown as Map<string, { placer: { input: FakeNode } }>;
    expect(voices.size).toBe(1);
    // The voice's placer ends in a merger wired to the hazard bus, not straight to the master.
    const reachesBus = (node: FakeNode, depth = 0): boolean =>
      node === hazardBus || (depth < 4 && node.outputs.some((next) => reachesBus(next, depth + 1)));
    expect(reachesBus([...voices.values()][0].placer.input)).toBe(true);
  });

  it("brings warnings back to full level when the answer ends or is stopped", () => {
    engine.playAnswer(answerBuffer(), 0);
    expect(bus()).toBeCloseTo(HALF, 6);
    answerSource()!.onended!();
    expect(bus()).toBe(1);

    engine.playAnswer(answerBuffer(), 0);
    expect(bus()).toBeCloseTo(HALF, 6);
    engine.stopAnswer();
    expect(bus()).toBe(1);
  });

  it("never turns down a drop-off or head-height warning", () => {
    engine.update([hazard("drop_off", 1.2)], WALKING);
    expect(engine.playAnswer(answerBuffer(), 0)).toBe(false);
    expect(bus()).toBe(1);

    engine.update([hazard("obstacle", 0.8)], WALKING);
    engine.playAnswer(answerBuffer(), 0);
    expect(bus()).toBeCloseTo(HALF, 6);
    // A head-height hazard shows up mid-answer: the answer stops and warnings go back to full.
    engine.update([hazard("head_height", 0.9)], WALKING);
    expect(engine.answerPlaying()).toBe(false);
    expect(bus()).toBe(1);
  });

  it("halves warnings while the phone's own voice reads an answer, until it says it is done", () => {
    const done = engine.duckForSpokenAnswer(4000);
    expect(bus()).toBeCloseTo(HALF, 6);
    done();
    expect(bus()).toBe(1);
  });

  it("lets the phone voice's duck run out on its own, capped, if the end never comes", () => {
    engine.duckForSpokenAnswer(60_000);
    expect(bus()).toBeCloseTo(HALF, 6);
    ctx.currentTime = AUDIO.spokenAnswerMaxMs / 1000 - 0.5;
    vi.advanceTimersByTime(AUDIO.schedulerTickMs);
    expect(bus()).toBeCloseTo(HALF, 6);
    ctx.currentTime = AUDIO.spokenAnswerMaxMs / 1000 + 0.1;
    vi.advanceTimersByTime(AUDIO.schedulerTickMs);
    expect(bus()).toBe(1);
  });

  it("ignores a late end from an older phone-voice answer", () => {
    const first = engine.duckForSpokenAnswer(4000);
    engine.duckForSpokenAnswer(4000);
    first();
    expect(bus()).toBeCloseTo(HALF, 6);
  });
});
