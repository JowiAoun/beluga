"use client";

import { MotionConfig } from "motion/react";
import { useCallback } from "react";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { setPaused, usePaused } from "./motionState";

export { setPaused, usePaused, useReducedMotionSafe, useStill } from "./motionState";

export function MotionPrefs({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// Stops everything that moves by itself (WCAG 2.2.2). `compact` shows only the icon below the md
// breakpoint; the name stays for screen readers.
export function PauseMotion({ className, compact = false }: { className?: string; compact?: boolean }) {
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
        "inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-md border border-line-strong px-3 font-display text-sm font-bold tracking-[0.02em] text-foreground uppercase transition-colors duration-300 ease-water hover:border-foreground",
        paused && "border-accent bg-accent text-on-accent hover:border-accent",
        className,
      )}
    >
      <Icon aria-hidden size={18} />
      <span className={cn(compact && "sr-only md:not-sr-only")}>Pause motion</span>
    </button>
  );
}
