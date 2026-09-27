// ffmpeg steps that shape ElevenLabs downloads for bone-conduction earbuds: a high-pass, silence
// trimmed off the start, a short fade, mono 48 kHz, then a level set by peak or by loudness. The
// downloads are lossless and so is every file made here, so nothing is lost on the way.

import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { AUDIO } from "@/lib/shared/params";

const SILENCE_DB = -45;
const FADE_S = 0.05;
// The rate ElevenLabs sends and phones play at, so nothing is resampled.
const RATE = "48000";

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
// Lossless like WAV, at about half the size, for the longer voice clips.
const FLAC = ["-c:a", "flac", "-sample_fmt", "s16", "-compression_level", "12"];

// Effects stay WAV: they are short, and every browser decodes WAV the moment it has it.
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
    RATE,
    ...WAV,
    tmp,
  );
  normalisePeak(tmp, out, WAV);
}

// A loop keeps its full length and its ends, or it would click where it wraps.
export function processLoop(raw: string, out: string): void {
  const tmp = `${out}.tmp.wav`;
  ffmpeg("-i", raw, "-af", HIGH_PASS, "-ac", "1", "-ar", RATE, ...WAV, tmp);
  normalisePeak(tmp, out, WAV);
}

// Eleven v3 often ends a clip with a breath or room tone a little above the trim's silence level.
// A quiet stretch of at least this long that runs to the end of the clip is cut, keeping enough
// after the last loud part for a soft ending. Trimming harder at the
// edges instead cut soft starts and endings: "bike" came out as "pike".
const TAIL_DB = -38;
const TAIL_MIN_S = 0.45;
const TAIL_KEEP_S = 0.25;

// When the clip ends in a quiet stretch, the time it starts; otherwise null.
function quietTailStart(file: string): number | null {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", `silencedetect=noise=${TAIL_DB}dB:d=${TAIL_MIN_S}`, "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const starts = [...run.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...run.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const start = starts.at(-1);
  if (start === undefined || start === 0) return null;
  // The last quiet stretch has no end before the file does.
  const end = ends.length === starts.length ? ends.at(-1)! : Infinity;
  return end >= durationS(file) - 0.02 ? start : null;
}

// Voices start softly: the "p" in "pole" rises from about -47 dB over 20 ms, and the effects' trim
// cut into it, so "pole" played as "oh". This one trims lower and keeps 50 ms before the word. At
// the end it keeps 200 ms, since a word like "stopped" ends in a pause and then a soft "t".
const CLIP_TRIM_START = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05";
const CLIP_TRIM_END = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.2";

export function processClip(raw: string, out: string): void {
  const tmp = `${out}.tmp.wav`;
  const trimBothEnds = `${CLIP_TRIM_START},areverse,${CLIP_TRIM_END},areverse`;
  ffmpeg("-i", raw, "-af", `${HIGH_PASS},${trimBothEnds}`, "-ac", "1", "-ar", RATE, ...WAV, tmp);
  const tail = quietTailStart(tmp);
  if (tail !== null) {
    const cut = `${out}.cut.wav`;
    const end = tail + TAIL_KEEP_S;
    ffmpeg("-i", tmp, "-af", `atrim=0:${end.toFixed(3)},afade=t=out:st=${(end - FADE_S).toFixed(3)}:d=${FADE_S}`, ...WAV, cut);
    rmSync(tmp);
    execFileSync("mv", [cut, tmp]);
  }
  if (durationS(tmp) < 0.5) {
    normalisePeak(tmp, out, FLAC);
    return;
  }
  ffmpeg("-i", tmp, "-af", `loudnorm=I=${AUDIO.voiceLufs}:TP=-1.5:LRA=11`, "-ar", RATE, ...FLAC, out);
  rmSync(tmp);
}
