"use client";

// Keeps a scene sharp while it runs well, and hands back to its still image only when it really
// can't keep up. drei's PerformanceMonitor counts every "running fine" check towards its flip-flop
// limit, so a healthy 60 Hz phone reached it in about 10 seconds and the 3D froze into the still.
// Here only slow checks count, and a good one clears them.

import { PerformanceMonitor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// A check is 2.5 s of frames. Slow is mostly under 24 frames a second, so only a phone that truly
// can't keep up falls back; the first slow check drops the pixel ratio. Mostly over 45 clears them.
const BOUNDS: [number, number] = [24, 45];
const SLOW_CHECKS_TO_FALL_BACK = 3;

export function Watchdog({
  onDpr,
  onFallback,
  children,
}: {
  onDpr: (dpr: number) => void;
  onFallback: () => void;
  children: React.ReactNode;
}) {
  const slow = useRef(0);
  const gl = useThree((state) => state.gl);

  // The browser can take a 3D context away, for instance when a page has too many. The still
  // image comes back instead of a frozen frame.
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onFallback);
    return () => canvas.removeEventListener("webglcontextlost", onFallback);
  }, [gl, onFallback]);

  return (
    <PerformanceMonitor
      bounds={() => BOUNDS}
      onIncline={() => {
        slow.current = 0;
      }}
      onDecline={() => {
        slow.current++;
        onDpr(1);
        if (slow.current >= SLOW_CHECKS_TO_FALL_BACK) onFallback();
      }}
    >
      {children}
    </PerformanceMonitor>
  );
}
