// The ElevenLabs sound library from Phase 3a: processed files in `public/sounds`, listed in
// `public/sounds/manifest.json`. Pages fetch the files when they load and decode them on the
// start tap, so every sound is in memory before the walk. With no manifest, the temporary tones
// from `tones.ts` play instead.

import type { SoundId } from "@/lib/shared/enums";

export const SOUNDS_PATH = "/sounds";

export interface LibrarySound {
  // The variant that plays, picked by ear on `/walk/sounds`. Paths are relative to `/sounds`.
  file: string;
  variants: string[];
  // Played instead of repeats in the closest band, for the sounds that have one.
  loop: string | null;
  loopVariants: string[];
  // Level trim against the other sounds, set by ear.
  gainDb: number;
  prompt: string;
}

export interface LibraryClip {
  file: string;
  text: string;
}

export interface LibraryManifest {
  generatedAt: string;
  sounds: Partial<Record<SoundId, LibrarySound>>;
  clips: Partial<Record<ClipId, LibraryClip>>;
}

// Every spoken clip. Hazard words and sides use the same ids as `wordFor` and `sideOf`.
export const CLIP_TEXT = {
  edge: "edge",
  step_down: "step down",
  head: "head",
  pole: "pole",
  bike: "bike",
  scooter: "scooter",
  car: "car",
  person: "person",
  blocked: "blocked",
  stairs: "stairs",
  left: "left",
  right: "right",
  ahead: "ahead",
  ready: "beluga ready, tap to start",
  take_steps: "take three slow steps",
  calibrated: "calibrated",
  hold_steady: "hold steady",
  stopped: "beluga stopped",
  reported: "reported",
  reporting_on: "reporting on",
  reporting_off: "reporting off",
  ask_offline: "Ask is offline. Obstacle alerts still on.",
  sorry: "Sorry, I couldn't see that.",
  alongside: "beluga works alongside your cane or guide dog. It can miss things.",
} as const;

export type ClipId = keyof typeof CLIP_TEXT;

export function isClipId(word: string): word is ClipId {
  return Object.hasOwn(CLIP_TEXT, word);
}

// The files as fetched, not yet decoded: decoding needs the AudioContext from the start tap.
export interface RawLibrary {
  manifest: LibraryManifest;
  files: Map<string, ArrayBuffer>;
}

export interface DecodedSound {
  buffer: AudioBuffer;
  loop: AudioBuffer | null;
  gainDb: number;
}

export interface DecodedLibrary {
  sounds: Partial<Record<SoundId, DecodedSound>>;
  clips: Partial<Record<ClipId, AudioBuffer>>;
}

// Null when there is no library yet or the network is down: the tones cover both.
export async function fetchLibrary(): Promise<RawLibrary | null> {
  try {
    const response = await fetch(`${SOUNDS_PATH}/manifest.json`, { cache: "no-cache" });
    if (!response.ok) return null;
    const manifest = (await response.json()) as LibraryManifest;
    const paths = new Set<string>();
    for (const sound of Object.values(manifest.sounds)) {
      if (!sound) continue;
      paths.add(sound.file);
      if (sound.loop) paths.add(sound.loop);
    }
    for (const clip of Object.values(manifest.clips)) if (clip) paths.add(clip.file);
    const files = new Map<string, ArrayBuffer>();
    await Promise.all(
      [...paths].map(async (file) => {
        const got = await fetch(`${SOUNDS_PATH}/${file}`);
        if (got.ok) files.set(file, await got.arrayBuffer());
      }),
    );
    return { manifest, files };
  } catch {
    return null;
  }
}

export async function decodeFile(ctx: BaseAudioContext, data: ArrayBuffer | undefined): Promise<AudioBuffer | null> {
  if (!data) return null;
  try {
    // Decoding takes over the buffer, so decode a copy and keep the file for the next session.
    return await ctx.decodeAudioData(data.slice(0));
  } catch {
    return null;
  }
}

export async function decodeLibrary(ctx: BaseAudioContext, raw: RawLibrary): Promise<DecodedLibrary> {
  const decoded: DecodedLibrary = { sounds: {}, clips: {} };
  const jobs: Array<Promise<void>> = [];
  for (const [id, sound] of Object.entries(raw.manifest.sounds) as Array<[SoundId, LibrarySound | undefined]>) {
    if (!sound) continue;
    jobs.push(
      (async () => {
        const buffer = await decodeFile(ctx, raw.files.get(sound.file));
        if (!buffer) return;
        const loop = sound.loop ? await decodeFile(ctx, raw.files.get(sound.loop)) : null;
        decoded.sounds[id] = { buffer, loop, gainDb: sound.gainDb };
      })(),
    );
  }
  for (const [id, clip] of Object.entries(raw.manifest.clips) as Array<[ClipId, LibraryClip | undefined]>) {
    if (!clip) continue;
    jobs.push(
      (async () => {
        const buffer = await decodeFile(ctx, raw.files.get(clip.file));
        if (buffer) decoded.clips[id] = buffer;
      })(),
    );
  }
  await Promise.all(jobs);
  return decoded;
}
