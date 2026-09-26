import { describe, expect, it } from "vitest";
import { SOUND_IDS } from "@/lib/shared/enums";
import { AUDIO } from "@/lib/shared/params";
import { renderTone, TONE_DESIGNS } from "./tones";

const RATE = 48_000;

function peakDb(samples: Float32Array): number {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return 20 * Math.log10(peak);
}

describe("temporary tones", () => {
  it("renders every sound id at the library's peak level and length", () => {
    for (const id of SOUND_IDS) {
      const tone = renderTone(id, RATE);
      expect(tone.samples.length).toBe(Math.round(TONE_DESIGNS[id].seconds * RATE));
      expect(peakDb(tone.samples)).toBeCloseTo(AUDIO.effectPeakDbfs, 3);
    }
  });

  it("never starts a note below 440 Hz, where bone conduction only buzzes", () => {
    for (const design of Object.values(TONE_DESIGNS)) {
      const notes = [...design.notes, ...(design.loop?.notes ?? [])];
      for (const note of notes) expect(Math.min(note.freq, note.to ?? note.freq)).toBeGreaterThanOrEqual(440);
    }
  });

  it("gives loops for the three closest-band sounds, silent at both ends so they repeat without a click", () => {
    for (const id of ["edge_pulse", "head_chime", "tick"] as const) {
      const loop = renderTone(id, RATE).loop!;
      expect(Math.abs(loop[0])).toBeLessThan(0.01);
      expect(Math.abs(loop[loop.length - 1])).toBeLessThan(0.01);
    }
    expect(renderTone("ping", RATE).loop).toBeNull();
  });

  it("ends every one-shot sound at silence", () => {
    for (const id of SOUND_IDS) {
      const { samples } = renderTone(id, RATE);
      expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.01);
    }
  });
});
