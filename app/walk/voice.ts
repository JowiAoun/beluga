// Speaks beluga's status lines with the phone's own text-to-speech voice, which works offline.
// The ElevenLabs clips from Phase 3 take over the lines they cover.

export const LINES = {
  take_steps: "take three slow steps",
  calibrated: "calibrated",
  hold_steady: "hold steady",
  stopped: "beluga stopped",
  no_ar: "This phone can't run beluga. It needs Chrome with AR support.",
  start_failed: "beluga could not start.",
  no_depth: "No depth on this phone. Obstacle alerts can't run.",
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
export function speakText(text: string): void {
  const synth = speech();
  if (!synth) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-CA";
  synth.speak(utterance);
}
