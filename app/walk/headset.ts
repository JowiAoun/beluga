// Ask from the earbuds' play/pause button (Phase 9 stretch). Chrome sends a headset button to a
// page only while it plays an <audio> element, and Web Audio doesn't count, so a silent clip loops
// for the whole walk. beluga also shows in the phone's media controls while it runs.

// Chrome shows media controls, and takes the button, only for media longer than 5 s.
const SILENCE_S = 10;
const SILENCE_RATE = 8000;
// A second press this soon after one is a bounce, not a new question.
const PRESS_GAP_MS = 1000;

// 8-bit mono WAV of silence: 128 is the middle, so every sample is zero.
function silentWav(): Blob {
  const samples = SILENCE_S * SILENCE_RATE;
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SILENCE_RATE, true);
  view.setUint32(28, SILENCE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  return new Blob([buffer], { type: "audio/wav" });
}

const ACTIONS: MediaSessionAction[] = ["play", "pause"];

// Call inside the start tap: the clip needs the tap to play. Returns the function that stops it.
export function startHeadsetButton(onPress: () => void): () => void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return () => {};
  const session = navigator.mediaSession;
  const url = URL.createObjectURL(silentWav());
  const audio = new Audio(url);
  audio.loop = true;
  void audio.play().catch(() => {});

  let lastPress = -Infinity;
  const press = () => {
    // A press would pause the clip, and the next one would then be "play": keep it playing.
    void audio.play().catch(() => {});
    session.playbackState = "playing";
    const now = performance.now();
    if (now - lastPress < PRESS_GAP_MS) return;
    lastPress = now;
    onPress();
  };
  session.metadata = new MediaMetadata({ title: "beluga is on", artist: "Press the earbud button to ask" });
  for (const action of ACTIONS) {
    try {
      session.setActionHandler(action, press);
    } catch {
      // An action this browser doesn't know.
    }
  }
  session.playbackState = "playing";

  return () => {
    for (const action of ACTIONS) {
      try {
        session.setActionHandler(action, null);
      } catch {
        // Same as above.
      }
    }
    session.metadata = null;
    session.playbackState = "none";
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    URL.revokeObjectURL(url);
  };
}
