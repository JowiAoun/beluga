"use client";

import { useEffect, useRef, useState } from "react";
import { CONTROLS } from "@/lib/shared/params";

// Stops only after a held press, so clothing brushing the screen can't end the session.
// With TalkBack on, double-tap and hold does the same. Enter or Space held works from a keyboard.
export default function StopButton({ onStop }: { onStop: () => void }) {
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const begin = () => {
    cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onStop();
    }, CONTROLS.stopLongPressMs);
  };

  return (
    <button
      type="button"
      aria-label="Stop beluga. Press and hold."
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat) begin();
      }}
      onKeyUp={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className="relative min-h-[33dvh] w-full touch-none overflow-hidden rounded-lg bg-red-800 text-3xl font-bold text-white select-none"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-red-500"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? `width ${CONTROLS.stopLongPressMs}ms linear` : "none",
        }}
      />
      <span className="relative">Hold to stop</span>
    </button>
  );
}
