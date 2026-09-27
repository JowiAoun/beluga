// The ElevenLabs sound library from Phase 3a: processed files in `public/sounds`, listed in
// `public/sounds/manifest.json`. Pages fetch the files when they load and decode them on the
// start tap, so every sound is in memory before the walk. With no manifest, the temporary tones
// from `tones.ts` play instead.

import type { SoundId } from "@/lib/shared/enums";
import { cachedSound, soundCache } from "./cache";
import type { VoiceKey } from "./voices";

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

export interface LibraryVoice {
  clips: Partial<Record<ClipId, LibraryClip>>;
  // The line played when the user taps Play in the voice picker.
  sample: string | null;
}

export interface LibraryManifest {
  generatedAt: string;
  sounds: Partial<Record<SoundId, LibrarySound>>;
  // The default voice's clips, for pages that don't let the user pick.
  clips: Partial<Record<ClipId, LibraryClip>>;
  // Every voice's clips, when the library has more than one voice.
  voices?: Partial<Record<VoiceKey, LibraryVoice>>;
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
  start_failed: "beluga could not start.",
  no_depth: "No depth on this phone. Obstacle alerts can't run.",
  camera_only:
    "Camera-only mode. It warns about things it can name, like people, bikes and chairs, and yellow edge strips. No step warnings.",
  tap_camera: "Tap the screen once to start the camera.",
  camera_dark: "The camera is covered or it's too dark. Warnings are off until it can see.",
  camera_light: "The camera can see again.",
  camera_denied: "beluga needs the camera. Allow it in the browser's settings for this site, then tap Start again.",
  problem_frames: "beluga stopped getting camera frames, so warnings are off. Press Stop, then Start again.",
  problem_depth:
    "beluga isn't getting depth, so warnings are off. Point the phone at the path ahead. If this stays, press Stop, then Start again.",
} as const;

export type ClipId = keyof typeof CLIP_TEXT;

// The first-run steps, said in the chosen voice as each one opens. Fetched one at a time from
// `setupPath`, since a walk never needs them.
export const SETUP_TEXT = {
  welcome: "beluga works alongside your cane or guide dog. It can miss things.",
  voice: "Pick the voice that says warnings and answers your questions. Tap Play to hear each one.",
  reporting: "Help the city by sharing anonymous hazard reports? You can change this any time in settings.",
  location:
    "Location marks where hazard reports happen, to about 100 metres. Chrome can't ask during a walk, so it asks now.",
  height: "How tall are you? beluga uses it to watch for things at head height.",
  ready: "Put the phone on your chest mount, camera facing forward, then tap Start.",
} as const;

export type SetupStep = keyof typeof SETUP_TEXT;

export function isClipId(word: string): word is ClipId {
  return Object.hasOwn(CLIP_TEXT, word);
}

// The files as fetched, not yet decoded: decoding needs the AudioContext from the start tap.
export interface RawLibrary {
  manifest: LibraryManifest;
  files: Map<string, ArrayBuffer>;
  offlineReady: boolean;
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
export async function fetchLibrary(voice?: VoiceKey): Promise<RawLibrary | null> {
  try {
    const cache = await soundCache();
    const response = await cachedSound(`${SOUNDS_PATH}/manifest.json`, cache, true);
    if (!response?.ok) return null;
    const full = (await response.json()) as LibraryManifest;
    // Only the chosen voice's clips download, in the place the default voice's would be.
    const manifest: LibraryManifest = { ...full, clips: (voice && full.voices?.[voice]?.clips) || full.clips };
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
        if (!/^[a-zA-Z0-9_/-]+\.(mp3|wav|flac)$/.test(file) || file.includes("..")) return;
        // Version the cache keys so regenerated clips replace their previous versions.
        const url = `${SOUNDS_PATH}/${file}?v=${encodeURIComponent(manifest.generatedAt)}`;
        const got = await cachedSound(url, cache);
        if (got?.ok) files.set(file, await got.arrayBuffer());
      }),
    );
    const offlineReady = !!cache && paths.size > 0 && files.size === paths.size &&
      (await Promise.all([...paths].map((file) =>
        cache.match(`${SOUNDS_PATH}/${file}?v=${encodeURIComponent(manifest.generatedAt)}`),
      ))).every(Boolean);
    return { manifest, files, offlineReady };
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
