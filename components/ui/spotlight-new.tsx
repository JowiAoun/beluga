"use client";

// Aceternity UI's Spotlight New, tinted like light coming down through water. The beams stop
// drifting with reduced motion or Pause motion.

import { motion } from "motion/react";
import { useStill } from "@/components/brand/MotionPrefs";

type SpotlightProps = {
  gradientFirst?: string;
  gradientSecond?: string;
  gradientThird?: string;
  translateY?: number;
  width?: number;
  height?: number;
  smallWidth?: number;
  duration?: number;
  xOffset?: number;
};

export function Spotlight({
  gradientFirst = "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(199, 95%, 80%, .10) 0, hsla(199, 95%, 60%, .03) 50%, hsla(199, 95%, 50%, 0) 80%)",
  gradientSecond = "radial-gradient(50% 50% at 50% 50%, hsla(199, 95%, 80%, .07) 0, hsla(199, 95%, 60%, .02) 80%, transparent 100%)",
  gradientThird = "radial-gradient(50% 50% at 50% 50%, hsla(199, 95%, 80%, .05) 0, hsla(199, 95%, 50%, .02) 80%, transparent 100%)",
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 9,
  xOffset = 100,
}: SpotlightProps = {}) {
  const still = useStill();
  const drift = (direction: 1 | -1) =>
    still
      ? { animate: { x: 0 } }
      : {
          animate: { x: [0, direction * xOffset, 0] },
          transition: { duration, repeat: Infinity, repeatType: "reverse" as const, ease: "easeInOut" as const },
        };

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden forced-colors:hidden"
    >
      <motion.div {...drift(1)} className="pointer-events-none absolute top-0 left-0 z-0 h-screen w-screen">
        <div
          style={{
            transform: `translateY(${translateY}px) rotate(-45deg)`,
            background: gradientFirst,
            width: `${width}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 left-0"
        />
        <div
          style={{
            transform: "rotate(-45deg) translate(5%, -50%)",
            background: gradientSecond,
            width: `${smallWidth}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 left-0 origin-top-left"
        />
        <div
          style={{
            transform: "rotate(-45deg) translate(-180%, -70%)",
            background: gradientThird,
            width: `${smallWidth}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 left-0 origin-top-left"
        />
      </motion.div>

      <motion.div {...drift(-1)} className="pointer-events-none absolute top-0 right-0 z-0 h-screen w-screen">
        <div
          style={{
            transform: `translateY(${translateY}px) rotate(45deg)`,
            background: gradientFirst,
            width: `${width}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 right-0"
        />
        <div
          style={{
            transform: "rotate(45deg) translate(-5%, -50%)",
            background: gradientSecond,
            width: `${smallWidth}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 right-0 origin-top-right"
        />
        <div
          style={{
            transform: "rotate(45deg) translate(180%, -70%)",
            background: gradientThird,
            width: `${smallWidth}px`,
            height: `${height}px`,
          }}
          className="absolute top-0 right-0 origin-top-right"
        />
      </motion.div>
    </motion.div>
  );
}
