"use client";

// The big Ask button that fills the overlay above Stop. A plain DOM button, so TalkBack users
// reach it with a double-tap and everyone else with one tap.
export default function AskButton({ asking, onAsk }: { asking: boolean; onAsk: () => void }) {
  return (
    <button
      type="button"
      onClick={onAsk}
      disabled={asking}
      aria-label={asking ? "Asking about what is in front of you" : "Ask what is in front of you"}
      className="min-h-[40dvh] flex-1 rounded-2xl border-4 border-white/70 bg-black/40 text-4xl font-bold text-white disabled:opacity-60"
    >
      {asking ? "Asking" : "Ask"}
    </button>
  );
}
