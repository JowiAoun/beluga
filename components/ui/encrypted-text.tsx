"use client";

// Aceternity UI's Encrypted Text, changed for beluga: the real text is in the HTML from the
// start, screen readers read a hidden copy, and it stays still with reduced motion or Pause motion.

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useStill } from "@/components/brand/MotionPrefs";
import { cn } from "@/lib/utils";

const CHARSET = "abcdefghijklmnopqrstuvwxyz";

function scramble(text: string, from: number) {
  let out = text.slice(0, from);
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    out += /\s|[.,'’]/.test(ch) ? ch : CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return out;
}

export function EncryptedText({
  text,
  className,
  revealDelayMs = 45,
  flipDelayMs = 70,
}: {
  text: string;
  className?: string;
  revealDelayMs?: number;
  flipDelayMs?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const still = useStill();
  const [shown, setShown] = useState(text);
  const done = useRef(false);

  useEffect(() => {
    if (!inView || still || done.current) return;
    const start = performance.now();
    let lastFlip = 0;
    let frame = requestAnimationFrame(function tick(now) {
      const revealed = Math.min(text.length, Math.floor((now - start) / revealDelayMs));
      if (revealed >= text.length) {
        done.current = true;
        setShown(text);
        return;
      }
      if (now - lastFlip >= flipDelayMs) {
        setShown(scramble(text, revealed));
        lastFlip = now;
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [inView, still, text, revealDelayMs, flipDelayMs]);

  // Pause motion part way through shows the real text at once.
  const display = still ? text : shown;

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={cn(display !== text && "text-sonar")}>
        {display}
      </span>
    </span>
  );
}
