"use client";

import { MotionConfig, useReducedMotion } from "motion/react";
import { useCallback, useSyncExternalStore } from "react";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const KEY = "beluga-motion";
const EVENT = "beluga-motion";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// The layout's inline script sets the attribute before the first paint, so the DOM is the truth.
function isPaused() {
  return document.documentElement.dataset.motion === "paused";
}

export function setPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  try {
    if (paused) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage. The switch still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePaused() {
  return useSyncExternalStore(subscribe, isPaused, () => false);
}

// True when nothing should move by itself: the Pause motion switch or the system's reduced motion.
export function useStill() {
  const paused = usePaused();
  const reduced = useReducedMotion();
  return paused || Boolean(reduced);
}

export function MotionPrefs({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function PauseMotion({ className }: { className?: string }) {
  const paused = usePaused();
  const toggle = useCallback(() => setPaused(!paused), [paused]);
  const Icon = paused ? IconPlayerPlayFilled : IconPlayerPauseFilled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={paused}
      onClick={toggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-white/10",
        paused && "border-accent/60 text-accent",
        className,
      )}
    >
      <Icon aria-hidden size={18} />
      Pause motion
    </button>
  );
}
