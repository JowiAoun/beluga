// The phone's own text-to-speech voice, which works offline. It says beluga's status lines only
// when their ElevenLabs recordings can't play: before they are decoded, or with no sound library.

import { CLIP_TEXT } from "@/lib/audio/library";

export const LINES = {
  take_steps: CLIP_TEXT.take_steps,
  calibrated: CLIP_TEXT.calibrated,
  hold_steady: CLIP_TEXT.hold_steady,
  stopped: CLIP_TEXT.stopped,
  no_ar: "This phone can't run beluga. It needs Chrome with AR support.",
  start_failed: CLIP_TEXT.start_failed,
  no_depth: CLIP_TEXT.no_depth,
  ask_offline: CLIP_TEXT.ask_offline,
  reporting_on: CLIP_TEXT.reporting_on,
  reporting_off: CLIP_TEXT.reporting_off,
  sorry: CLIP_TEXT.sorry,
  camera_only: CLIP_TEXT.camera_only,
  tap_camera: CLIP_TEXT.tap_camera,
  camera_dark: CLIP_TEXT.camera_dark,
  camera_light: CLIP_TEXT.camera_light,
  camera_denied: CLIP_TEXT.camera_denied,
} as const;

export type Line = keyof typeof LINES;

function speech(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

// Chrome only lets a page speak after a tap, so call this inside the start tap.
export function unlockVoice(): void {
  const synth = speech();
  if (!synth) return;
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  synth.speak(silent);
}

export function say(line: Line): void {
  speakText(LINES[line]);
}

// For hazard words like "pole, left", which the recorded clips from Phase 3a will replace.
// `onDone` runs when the voice finishes or fails, or at once when there is no voice.
export function speakText(text: string, onDone?: () => void): void {
  const synth = speech();
  if (!synth) {
    onDone?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-CA";
  if (onDone) {
    utterance.onend = onDone;
    utterance.onerror = onDone;
  }
  synth.speak(utterance);
}

// The warning loop may only use a voice confirmed to be installed on this device.
// If none is available, the local warning tone still plays.
export function speakLocalText(text: string): void {
  const synth = speech();
  const voice = synth?.getVoices().find((voice) => voice.localService && voice.lang.startsWith("en"));
  if (!synth || !voice) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  synth.speak(utterance);
}

// One recording at a time outside a walk, such as a setup step: a new one cuts the last one, and
// the phone's voice too. When the file can't play (offline, never fetched), the phone's voice says
// the text instead.
let recording: HTMLAudioElement | null = null;

export function playRecording(url: string, text: string): void {
  stopRecording();
  speech()?.cancel();
  const audio = new Audio(url);
  recording = audio;
  audio.play().catch(() => {
    if (recording !== audio) return;
    recording = null;
    speakText(text);
  });
}

export function stopRecording(): void {
  recording?.pause();
  recording = null;
}
