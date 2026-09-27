"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { attachContours } from "./contourField";
import { Contours } from "./Contours";
import { useStill } from "./motionState";

// Depth contours that slowly reshape, like the lines on landonorris.com. The still lines show
// first, and stay with Pause motion, reduced motion or no WebGL2. Decoration only.
export function LiveContours({ variant = "a", className }: { variant?: "a" | "b"; className?: string }) {
  const still = useStill();
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (still || !canvas) return;
    return attachContours(
      canvas,
      variant === "a" ? 1 : 2,
      () => setDrawn(true),
      () => setFailed(true),
    );
  }, [still, variant]);

  const live = drawn && !still && !failed;
  return (
    <>
      <Contours variant={variant} className={cn(className, live && "invisible")} />
      <canvas
        ref={ref}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 size-full contrast-more:hidden forced-colors:hidden",
          !live && "invisible",
          className,
        )}
      />
    </>
  );
}
