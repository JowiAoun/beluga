"use client";

import { IconEye } from "@tabler/icons-react";

// The big Ask button that fills the overlay above Stop. A plain DOM button, so TalkBack users
// reach it with a double-tap and everyone else with one tap.
export default function AskButton({ asking, onAsk }: { asking: boolean; onAsk: () => void }) {
  return (
    <button
      type="button"
      onClick={onAsk}
      disabled={asking}
      aria-label={asking ? "Asking about what is in front of you" : "Ask what is in front of you"}
      className="flex min-h-[40dvh] flex-1 flex-col items-center justify-center gap-3 rounded-md border-4 border-accent bg-abyss/75 text-4xl font-bold text-foreground disabled:opacity-60"
    >
      <IconEye aria-hidden size={48} stroke={1.75} className="text-accent" />
      {asking ? "Asking" : "Ask"}
    </button>
  );
}
