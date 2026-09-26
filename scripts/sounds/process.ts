// ffmpeg steps that shape ElevenLabs downloads for bone-conduction earbuds: a high-pass, silence
// trimmed off the start, a short fade, mono 44.1 kHz, then a level set by peak or by loudness.

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { AUDIO } from "@/lib/shared/params";

const SILENCE_DB = -45;
const FADE_S = 0.05;

function ffmpeg(...ffArgs: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...ffArgs], { stdio: "inherit" });
}

function peakDb(file: string): number {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const match = /max_volume: (-?[\d.]+) dB/.exec(run.stderr);
  if (!match) throw new Error(`no level for ${file}`);
  return Number(match[1]);
}

export function durationS(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], {
    encoding: "utf8",
  });
  return Number(out.trim());
}

const HIGH_PASS = `highpass=f=${AUDIO.highPassHz}`;
const TRIM_START = `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}dB`;

// Peak normalising: loudness can't be measured on clips shorter than 0.4 s. The temporary file goes
// either way, so a take that trims to nothing doesn't leave one in public/sounds.
function normalisePeak(tmp: string, out: string, codec: string[]): void {
  try {
    ffmpeg("-i", tmp, "-af", `volume=${(AUDIO.effectPeakDbfs - peakDb(tmp)).toFixed(2)}dB`, ...codec, out);
  } finally {
    rmSync(tmp, { force: true });
  }
}

const WAV = ["-c:a", "pcm_s16le"];
const MP3 = ["-c:a", "libmp3lame", "-q:a", "4"];

// Effects stay WAV: an MP3 starts with a few milliseconds of padding, and warnings need every one.
export function processEffect(raw: string, out: string, seconds: number): void {
  const tmp = `${out}.tmp.wav`;
  const fade = `afade=t=out:st=${Math.max(0, seconds - FADE_S).toFixed(3)}:d=${FADE_S}`;
  ffmpeg(
    "-i",
    raw,
    "-af",
    `${HIGH_PASS},${TRIM_START},atrim=0:${seconds},${fade}`,
    "-ac",
    "1",
    "-ar",
    "44100",
    ...WAV,
    tmp,
  );
  normalisePeak(tmp, out, WAV);
}

// A loop keeps its full length and its ends, or it would click where it wraps.
export function processLoop(raw: string, out: string): void {
  const tmp = `${out}.tmp.wav`;
  ffmpeg("-i", raw, "-af", HIGH_PASS, "-ac", "1", "-ar", "44100", ...WAV, tmp);
  normalisePeak(tmp, out, WAV);
}

export function processClip(raw: string, out: string): void {
  const tmp = `${out}.tmp.wav`;
  const trimBothEnds = `${TRIM_START},areverse,${TRIM_START},areverse`;
  ffmpeg("-i", raw, "-af", `${HIGH_PASS},${trimBothEnds}`, "-ac", "1", "-ar", "44100", ...WAV, tmp);
  if (durationS(tmp) < 0.5) {
    normalisePeak(tmp, out, MP3);
    return;
  }
  ffmpeg("-i", tmp, "-af", `loudnorm=I=${AUDIO.voiceLufs}:TP=-1.5:LRA=11`, "-ar", "44100", ...MP3, out);
  rmSync(tmp);
}
