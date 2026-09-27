// Temporary warning sounds drawn in code, used until the ElevenLabs library from Phase 3a lands
// in `public/sounds`. They follow the same rules as that library: no note starts below 440 Hz,
// since bone conduction plays little under about 300 Hz and buzzes there, and pitch stands for
// height, since bone conduction can't place a sound up or down.

import type { SoundId } from "@/lib/shared/enums";
import { AUDIO } from "@/lib/shared/params";

interface Note {
  // Start and length in seconds.
  at: number;
  length: number;
  freq: number;
  // Glides to this frequency over the note.
  to?: number;
  // Seconds for the level to fall to about a third.
  decay: number;
  attack?: number;
  // Extra partials as [frequency ratio, level].
  partials?: ReadonlyArray<readonly [number, number]>;
}

interface ToneDesign {
  seconds: number;
  notes: Note[];
  // Played in the closest band instead of repeats: the same idea as a fast pulse train.
  loop?: { seconds: number; notes: Note[] };
  // Level trim in dB against the others, set by ear on the audition page.
  trimDb: number;
}

const WOOD = [
  [2.5, 0.5],
  [4.1, 0.3],
] as const;
const GLASS = [[2.76, 0.25]] as const;

// Four notes, one every 80 ms, for a loop that repeats seamlessly.
function pulses(note: Omit<Note, "at">, alternate?: number): Note[] {
  return [0, 1, 2, 3].map((i) => ({ ...note, at: i * 0.08, freq: alternate && i % 2 ? alternate : note.freq }));
}

export const TONE_DESIGNS: Record<SoundId, ToneDesign> = {
  // Drop-off: a tone that falls, like something going down.
  edge_pulse: {
    seconds: 0.25,
    notes: [{ at: 0, length: 0.25, freq: 900, to: 450, decay: 0.2, attack: 0.01, partials: [[2, 0.3]] }],
    loop: { seconds: 0.32, notes: pulses({ length: 0.07, freq: 700, to: 450, decay: 0.05, attack: 0.005 }) },
    trimDb: 0,
  },
  // Head height: two high glass notes going up.
  head_chime: {
    seconds: 0.25,
    notes: [
      { at: 0, length: 0.12, freq: 1760, decay: 0.08, partials: GLASS },
      { at: 0.11, length: 0.14, freq: 2350, decay: 0.08, partials: GLASS },
    ],
    loop: { seconds: 0.32, notes: pulses({ length: 0.07, freq: 1760, decay: 0.04, partials: GLASS }, 2350) },
    trimDb: -2,
  },
  tick: {
    seconds: 0.06,
    notes: [{ at: 0, length: 0.06, freq: 1000, decay: 0.012, attack: 0.001, partials: WOOD }],
    loop: { seconds: 0.32, notes: pulses({ length: 0.06, freq: 1000, decay: 0.012, attack: 0.001, partials: WOOD }) },
    trimDb: 0,
  },
  ping: {
    seconds: 0.15,
    notes: [{ at: 0, length: 0.15, freq: 2600, decay: 0.04, attack: 0.001, partials: [[2.3, 0.2]] }],
    trimDb: -3,
  },
  bell: {
    seconds: 0.2,
    notes: [0, 0.1].map((at) => ({
      at,
      length: 0.1,
      freq: 2100,
      decay: 0.05,
      attack: 0.001,
      partials: [
        [1.5, 0.4],
        [2.7, 0.2],
      ] as const,
    })),
    trimDb: -3,
  },
  marimba: {
    seconds: 0.15,
    notes: [{ at: 0, length: 0.15, freq: 660, decay: 0.05, attack: 0.002, partials: [[4, 0.25]] }],
    trimDb: 0,
  },
  // Vehicles: a short horn-like tone, its odd harmonics up to about 3 kHz.
  buzz: {
    seconds: 0.2,
    notes: [
      {
        at: 0,
        length: 0.2,
        freq: 440,
        decay: 1,
        attack: 0.01,
        partials: [
          [3, 0.5],
          [5, 0.3],
          [7, 0.15],
        ],
      },
    ],
    trimDb: -4,
  },
  // Blocked path: three quick taps.
  taps: {
    seconds: 0.25,
    notes: [0, 0.08, 0.16].map((at) => ({ at, length: 0.05, freq: 800, decay: 0.012, attack: 0.001, partials: [[2.3, 0.4]] as const })),
    trimDb: 0,
  },
  listening: {
    seconds: 0.3,
    notes: [
      { at: 0, length: 0.14, freq: 880, decay: 0.1 },
      { at: 0.14, length: 0.16, freq: 1320, decay: 0.1 },
    ],
    trimDb: -3,
  },
  ready: {
    seconds: 0.8,
    notes: [0, 0.2, 0.4].map((at, i) => ({ at, length: 0.4, freq: [660, 880, 1100][i], decay: 0.15 })),
    trimDb: -3,
  },
  reported: {
    seconds: 0.2,
    notes: [{ at: 0, length: 0.2, freq: 800, to: 1600, decay: 0.05, attack: 0.002 }],
    trimDb: -3,
  },
  // Straight ahead: a tiny click in both ears with each repeat.
  centre_tick: {
    seconds: 0.03,
    notes: [{ at: 0, length: 0.03, freq: 3000, decay: 0.006, attack: 0.001 }],
    trimDb: -9,
  },
};

// Fades the last few milliseconds of each note, so no note ends on a click.
const END_FADE_S = 0.01;

function renderNotes(notes: Note[], seconds: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (const note of notes) {
    const start = Math.round(note.at * sampleRate);
    const count = Math.min(Math.round(note.length * sampleRate), out.length - start);
    const attack = note.attack ?? 0.003;
    const end = note.to ?? note.freq;
    let phase = 0;
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      // Exponential glide, so the pitch moves evenly to the ear.
      phase += (2 * Math.PI * note.freq * (end / note.freq) ** (t / note.length)) / sampleRate;
      const level =
        Math.min(1, t / attack) * Math.exp(-t / note.decay) * Math.max(0, Math.min(1, (note.length - t) / END_FADE_S));
      let value = Math.sin(phase);
      for (const [ratio, amount] of note.partials ?? []) value += amount * Math.sin(phase * ratio);
      out[start + i] += level * value;
    }
  }
  return out;
}

// Scales so the loudest sample sits at the library's peak level.
function normalise(samples: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer> {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  if (peak === 0) return samples;
  const scale = 10 ** (AUDIO.effectPeakDbfs / 20) / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

export interface RenderedTone {
  samples: Float32Array<ArrayBuffer>;
  loop: Float32Array<ArrayBuffer> | null;
  trimDb: number;
}

function render(design: ToneDesign, sampleRate: number): RenderedTone {
  return {
    samples: normalise(renderNotes(design.notes, design.seconds, sampleRate)),
    loop: design.loop ? normalise(renderNotes(design.loop.notes, design.loop.seconds, sampleRate)) : null,
    trimDb: design.trimDb,
  };
}

export function renderTone(id: SoundId, sampleRate: number): RenderedTone {
  return render(TONE_DESIGNS[id], sampleRate);
}

// Warnings stopped for a moment (no camera frames, or no depth): two soft notes going down, slower
// and quieter than any warning, and played once. Never a hazard sound, so it can't be taken for one.
const ALERT: ToneDesign = {
  seconds: 0.55,
  notes: [
    { at: 0, length: 0.22, freq: 740, decay: 0.2, attack: 0.015, partials: [[2, 0.15]] },
    { at: 0.27, length: 0.28, freq: 554, decay: 0.22, attack: 0.015, partials: [[2, 0.15]] },
  ],
  trimDb: -6,
};

export function renderAlert(sampleRate: number): RenderedTone {
  return render(ALERT, sampleRate);
}
