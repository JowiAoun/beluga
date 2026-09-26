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
