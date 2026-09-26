"use client";

// Magic UI's Number Ticker, changed for beluga: screen readers read the final number from a hidden
// copy, and it shows the final number at once with reduced motion or Pause motion.

import { useInView, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { useStill } from "@/components/brand/MotionPrefs";
import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  delay?: number;
  decimalPlaces?: number;
  suffix?: string;
}

function format(value: number, decimalPlaces: number) {
  return Intl.NumberFormat("en-CA", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(value.toFixed(decimalPlaces)));
}

export function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  className,
  decimalPlaces = 0,
  suffix = "",
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useStill();
  const motionValue = useMotionValue(startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (!isInView) return;
    if (still) {
      motionValue.jump(value);
      springValue.jump(value);
      return;
    }
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, springValue, isInView, delay, value, still]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format(latest, decimalPlaces) + suffix;
      }),
    [springValue, decimalPlaces, suffix],
  );

  return (
    <span className={cn("inline-block font-mono tabular-nums", className)} {...props}>
      <span className="sr-only">{format(value, decimalPlaces) + suffix}</span>
      <span ref={ref} aria-hidden>
        {format(startValue, decimalPlaces) + suffix}
      </span>
    </span>
  );
}
