"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

// A heading whose words come in one after another, blurred to sharp. Screen readers get the
// whole heading from the hidden copy.
export function RevealHeading({
  id,
  text,
  className,
  as = "h2",
}: {
  id?: string;
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const Tag = as;
  const words = text.split(" ");
  return (
    <Tag id={id} className={cn("text-balance", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <motion.span
            key={i}
            className="inline-block whitespace-pre"
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
          >
            {i < words.length - 1 ? `${word} ` : word}
          </motion.span>
        ))}
      </span>
    </Tag>
  );
}
