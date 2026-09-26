"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DISPLAY } from "./Display";

const EASE = [0.65, 0.05, 0, 1] as const;
const VIEW = { once: true, margin: "0px 0px -10% 0px" } as const;

// Fades and lifts its children in the first time they scroll into view, then stays.
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "p";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

const LINE = {
  hidden: { y: "105%" },
  shown: (i: number) => ({ y: "0%", transition: { duration: 0.9, delay: i * 0.08, ease: EASE } }),
};

// An uppercase heading whose lines slide up out of a mask, one after another. The text is real
// text in reading order, so screen readers need no copy. With reduced motion the lines are
// just there.
export function RevealHeading({
  id,
  lines,
  className,
  as = "h2",
}: {
  id?: string;
  lines: React.ReactNode[];
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const Tag = motion[as];
  return (
    <Tag id={id} className={cn(DISPLAY, className)} initial="hidden" whileInView="shown" viewport={VIEW}>
      {lines.map((line, i) => (
        <span key={i} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
          <motion.span className="block" variants={LINE} custom={i}>
            {line}
          </motion.span>
          {i < lines.length - 1 && " "}
        </span>
      ))}
    </Tag>
  );
}
