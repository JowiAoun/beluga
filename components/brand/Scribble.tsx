"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useStill } from "./motionState";

// A hand-drawn wave with three sonar arcs coming off it, the logo's motif. It draws itself in
// once it scrolls into view, and shows whole with reduced motion or Pause motion.
const STROKES = [
  "M10 122C34 104 52 70 86 64c34-6 44 30 22 50-22 20-46-4-30-34 16-30 58-38 92-22 30 14 40 50 76 46 30-4 42-34 54-58",
  "M322 58c14 16 16 40 2 58",
  "M344 38c24 26 26 66 2 94",
  "M368 18c34 36 36 94 2 132",
];

export function Scribble({ className }: { className?: string }) {
  const still = useStill();
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 160"
      fill="none"
      className={cn("pointer-events-none text-accent contrast-more:hidden forced-colors:hidden", className)}
    >
      {STROKES.map((d, i) =>
        still ? (
          <path key={i} d={d} stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <motion.path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "0px 0px -15% 0px" }}
            transition={{ duration: i === 0 ? 1.3 : 0.45, delay: i === 0 ? 0 : 1 + i * 0.18, ease: [0.65, 0.05, 0, 1] }}
          />
        ),
      )}
    </svg>
  );
}
