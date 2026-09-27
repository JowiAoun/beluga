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
  ask_offline: "Ask is offline. Obstacle alerts still on.",
  reporting_on: "reporting on",
  reporting_off: "reporting off",
  sorry: "Sorry, I couldn't see that.",
  camera_only:
    "Camera-only mode. It warns about things it can name, like people, bikes and chairs, and yellow edge strips. No step warnings.",
  tap_camera: "Tap the screen once to start the camera.",
  camera_dark: "The camera is covered or it's too dark. Warnings are off until it can see.",
  camera_light: "The camera can see again.",
  camera_denied: "beluga needs the camera. Allow it in the browser's settings for this site, then tap Start again.",
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
