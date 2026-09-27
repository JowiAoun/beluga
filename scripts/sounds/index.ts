// Best Use of ElevenLabs: builds beluga's warning sounds with the Sound Effects API and its voice
// clips with Text to Speech, then shapes them for bone-conduction earbuds with ffmpeg.
//
// Run `npm run sounds`, pick the best variants by ear on `/walk/sounds`, then commit
// `public/sounds`. Downloads are kept in `scripts/sounds/raw` (not committed), so a second run
// spends no credits on what it already has. Options: `--only tick,ping`, `--fresh`, and
// `--voices`, which makes only the five voices' clips and samples and leaves the effects alone.
//
// Everything downloads lossless at 48 kHz, the best the plan allows: voices from ElevenLabs' best
// model (voices.ts), effects as raw PCM, which gets a WAV header here.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CLIP_TEXT,
  SETUP_TEXT,
  type ClipId,
  type LibraryManifest,
  type LibrarySound,
  type SetupStep,
} from "@/lib/audio/library";
import { SOUND_IDS } from "@/lib/shared/enums";
import { DEFAULT_VOICE, samplePath, setupPath, TTS_FORMAT, TTS_MODEL, VOICES, type VoiceKey } from "@/lib/audio/voices";
import { processClip, processEffect, processLoop } from "./process";
import { EFFECTS, loopPrompt } from "./prompts";

const API = "https://api.elevenlabs.io/v1";
const RAW_DIR = "scripts/sounds/raw";
const OUT_DIR = "public/sounds";
const MANIFEST = path.join(OUT_DIR, "manifest.json");

const EFFECT_VARIANTS = 3;
// Sound Effects has no WAV format, only headerless 16-bit PCM, and it comes in stereo.
const EFFECT_FORMAT = "pcm_48000";
const EFFECT_RATE = 48000;
const EFFECT_CHANNELS = 2;
const LOOP_VARIANTS = 2;
const PROMPT_INFLUENCE = 0.75;
// Requests at the same time. Each one takes a second or two.
const PARALLEL = 4;

const args = process.argv.slice(2);
const fresh = args.includes("--fresh");
const voicesOnly = args.includes("--voices");
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : null;

const apiKey = process.env.ELEVENLABS_API_KEY;

// A full stop tells the model the line is finished, so a single word ends cleanly.
function spoken(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function elevenlabs(route: string, body: object): Promise<Buffer> {
  const response = await fetch(`${API}${route}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey!, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${route}: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

// A 44-byte WAV header in front of raw 16-bit PCM, so ffmpeg can read it like any file.
function wav(pcm: Buffer, rate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function soundEffect(body: object): Promise<Buffer> {
  return wav(await elevenlabs(`/sound-generation?output_format=${EFFECT_FORMAT}`, body), EFFECT_RATE, EFFECT_CHANNELS);
}

// Reuses a download unless --fresh, so reruns cost nothing.
async function download(file: string, make: () => Promise<Buffer>): Promise<string> {
  const target = path.join(RAW_DIR, file);
  if (fresh || !existsSync(target)) writeFileSync(target, await make());
  return target;
}

async function inParallel(jobs: Array<() => Promise<void>>): Promise<string[]> {
  const failures: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        await job();
      } catch (err) {
        failures.push(err instanceof Error ? err.message : String(err));
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return failures;
}

function readManifest(): LibraryManifest | null {
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as LibraryManifest;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!apiKey) fail("Set ELEVENLABS_API_KEY in .env.local first.");
  if (!apiKey.startsWith("sk_")) {
    fail("ELEVENLABS_API_KEY doesn't start with sk_: that looks like the key's ID. Paste the secret key instead.");
  }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    fail("ffmpeg is missing. Install it and run again.");
  }
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(path.join(OUT_DIR, "voice"), { recursive: true });

  const wanted = (id: string) => !only || only.has(id);
  const jobs: Array<() => Promise<void>> = [];

  for (const id of voicesOnly ? [] : SOUND_IDS.filter(wanted)) {
    const effect = EFFECTS[id];
    // The API's shortest sound is 0.5 s; asking for a bit more than the target gives room to trim.
    const requestS = Math.min(1, Math.max(0.5, effect.seconds * 2));
    for (let v = 1; v <= EFFECT_VARIANTS; v++) {
      jobs.push(async () => {
        // The format is in the name, so a better format later makes new downloads.
        const raw = await download(`${id}-${v}-${EFFECT_FORMAT}.wav`, () =>
          soundEffect({
            text: effect.prompt,
            duration_seconds: requestS,
            prompt_influence: PROMPT_INFLUENCE,
            model_id: "eleven_text_to_sound_v2",
          }),
        );
        processEffect(raw, path.join(OUT_DIR, `${id}-${v}.wav`), effect.seconds);
        console.info(`sound ${id} variant ${v}`);
      });
    }
    if (!effect.loop) continue;
    for (let v = 1; v <= LOOP_VARIANTS; v++) {
      jobs.push(async () => {
        const raw = await download(`${id}-loop-${v}-${EFFECT_FORMAT}.wav`, () =>
          soundEffect({
            text: loopPrompt(effect),
            duration_seconds: 1,
            prompt_influence: PROMPT_INFLUENCE,
            loop: true,
            model_id: "eleven_text_to_sound_v2",
          }),
        );
        processLoop(raw, path.join(OUT_DIR, `${id}-loop-${v}.wav`));
        console.info(`loop ${id} variant ${v}`);
      });
    }
  }

  const clipIds = (Object.keys(CLIP_TEXT) as ClipId[]).filter(wanted);
  const tts = (voice: (typeof VOICES)[number], text: string) =>
    elevenlabs(`/text-to-speech/${voice.elevenId}?output_format=${TTS_FORMAT}`, { text, model_id: TTS_MODEL });
  for (const voice of VOICES) {
    mkdirSync(path.join(OUT_DIR, "voice", voice.key), { recursive: true });
    for (const id of clipIds) {
      jobs.push(async () => {
        // The model and format are in the name, so a better one later makes new downloads.
        const raw = await download(`voice-${voice.key}-${TTS_MODEL}-${TTS_FORMAT}-${id}.wav`, () =>
          tts(voice, spoken(CLIP_TEXT[id])),
        );
        processClip(raw, path.join(OUT_DIR, "voice", voice.key, `${id}.flac`));
        console.info(`clip ${voice.key} ${id}`);
      });
    }
    if (only) continue;
    jobs.push(async () => {
      const raw = await download(`sample-${voice.key}-${TTS_MODEL}-${TTS_FORMAT}.wav`, () => tts(voice, voice.sample));
      processClip(raw, path.join(OUT_DIR, samplePath(voice.key)));
      console.info(`sample ${voice.key}`);
    });
    for (const step of Object.keys(SETUP_TEXT) as SetupStep[]) {
      jobs.push(async () => {
        const raw = await download(`setup-${voice.key}-${TTS_MODEL}-${TTS_FORMAT}-${step}.wav`, () =>
          tts(voice, SETUP_TEXT[step]),
        );
        processClip(raw, path.join(OUT_DIR, setupPath(voice.key, step)));
        console.info(`setup ${voice.key} ${step}`);
      });
    }
  }

  const failures = await inParallel(jobs);

  // Keeps the team's picks and trims from the last manifest.
  const previous = readManifest();
  const manifest: LibraryManifest = { generatedAt: new Date().toISOString(), sounds: {}, clips: {} };
  for (const id of SOUND_IDS) {
    const effect = EFFECTS[id];
    const variants = range(EFFECT_VARIANTS)
      .map((v) => `${id}-${v}.wav`)
      .filter((f) => existsSync(path.join(OUT_DIR, f)));
    if (variants.length === 0) continue;
    const loopVariants = effect.loop
      ? range(LOOP_VARIANTS)
          .map((v) => `${id}-loop-${v}.wav`)
          .filter((f) => existsSync(path.join(OUT_DIR, f)))
      : [];
    const before: LibrarySound | undefined = previous?.sounds[id];
    manifest.sounds[id] = {
      file: before && variants.includes(before.file) ? before.file : variants[0],
      variants,
      loop: before?.loop && loopVariants.includes(before.loop) ? before.loop : (loopVariants[0] ?? null),
      loopVariants,
      gainDb: before?.gainDb ?? 0,
      prompt: effect.prompt,
    };
  }
  manifest.voices = {};
  for (const voice of VOICES) {
    const clips: LibraryManifest["clips"] = {};
    for (const id of Object.keys(CLIP_TEXT) as ClipId[]) {
      const file = `voice/${voice.key}/${id}.flac`;
      if (existsSync(path.join(OUT_DIR, file))) clips[id] = { file, text: CLIP_TEXT[id] };
    }
    const sample = samplePath(voice.key);
    manifest.voices[voice.key as VoiceKey] = { clips, sample: existsSync(path.join(OUT_DIR, sample)) ? sample : null };
  }
  manifest.clips = manifest.voices[DEFAULT_VOICE]?.clips ?? {};
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  const soundCount = Object.keys(manifest.sounds).length;
  const clipCount = Object.keys(manifest.clips).length;
  console.info(`Wrote ${MANIFEST}: ${soundCount} sounds, ${clipCount} voice clips.`);
  if (failures.length > 0) fail(`${failures.length} failed:\n${failures.join("\n")}`);
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

void main();
