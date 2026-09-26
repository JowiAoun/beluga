import type { SoundId } from "@/lib/shared/enums";

// The sound table from Phase 3a in docs/PLAN.md. Every prompt keeps clear of sub-bass, since
// bone conduction plays little below about 300 Hz, and pitch stands for height.
export interface EffectPrompt {
  prompt: string;
  // Length after trimming, in seconds.
  seconds: number;
  // The closest band plays a loop variant of these instead of fast repeats.
  loop: boolean;
}

export const EFFECTS: Record<SoundId, EffectPrompt> = {
  edge_pulse: {
    prompt: "Short soft tone sliding down in pitch, like a falling whistle, mid range, clean, no reverb",
    seconds: 0.25,
    loop: true,
  },
  head_chime: {
    prompt: "Two quick bright glass chime notes, the second higher, short and clean",
    seconds: 0.25,
    loop: true,
  },
  tick: { prompt: "Short dry wooden block tick, percussive, no reverb", seconds: 0.12, loop: true },
  ping: {
    prompt: "Single tiny metallic ping, like tapping a thin steel pole, very short and dry",
    seconds: 0.15,
    loop: false,
  },
  bell: { prompt: "Quick tiny double bicycle bell ring, crisp and dry", seconds: 0.2, loop: false },
  marimba: {
    prompt: "Soft muted marimba note in the middle register, warm, short decay",
    seconds: 0.15,
    loop: false,
  },
  buzz: { prompt: "Very short gentle car horn beep, mid pitch, not alarming, no reverb", seconds: 0.2, loop: false },
  taps: { prompt: "Three rapid soft taps on hollow plastic", seconds: 0.25, loop: false },
  listening: { prompt: "Gentle rising two-tone chime, friendly", seconds: 0.3, loop: false },
  ready: { prompt: "Warm soft three-note rising chime", seconds: 0.8, loop: false },
  reported: { prompt: "Soft single water-drop blip", seconds: 0.2, loop: false },
  centre_tick: { prompt: "Very short soft click", seconds: 0.05, loop: false },
};

// Loops stand for "very close": the same sound repeating about 12 times a second.
export function loopPrompt(effect: EffectPrompt): string {
  return `${effect.prompt}, repeating rapidly and evenly, about twelve times a second`;
}
