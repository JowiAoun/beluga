"use client";

// Aceternity UI's Glowing Effect, in beluga's sonar blue and tactile yellow. A glow follows the
// pointer around the card's border. It is decoration only: it does nothing on touch, stays off
// with reduced motion or Pause motion, and hides under high contrast and forced colours.
// The parent needs `relative` and a rounded corner class.

import { animate } from "motion/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { useStill } from "@/components/brand/MotionPrefs";
import { cn } from "@/lib/utils";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}

const GRADIENT = `radial-gradient(circle, #38bdf8 10%, #38bdf800 20%),
  radial-gradient(circle at 40% 40%, #fde047 5%, #fde04700 15%),
  radial-gradient(circle at 60% 60%, #7dd3fc 10%, #7dd3fc00 20%),
  radial-gradient(circle at 40% 60%, #0ea5e9 10%, #0ea5e900 20%),
  repeating-conic-gradient(
    from 236.84deg at 50% 50%,
    #38bdf8 0%,
    #fde047 calc(25% / 5),
    #7dd3fc calc(50% / 5),
    #0ea5e9 calc(75% / 5),
    #38bdf8 calc(100% / 5)
  )`;

export const GlowingEffect = memo(function GlowingEffect({
  blur = 0,
  inactiveZone = 0.6,
  proximity = 64,
  spread = 32,
  className,
  movementDuration = 1.6,
  borderWidth = 2,
  disabled = false,
}: GlowingEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);
  const still = useStill();
  const off = disabled || still;

  const handleMove = useCallback(
    (e?: { x: number; y: number }) => {
      if (!containerRef.current) return;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      animationFrameRef.current = requestAnimationFrame(() => {
        const element = containerRef.current;
        if (!element) return;

        const { left, top, width, height } = element.getBoundingClientRect();
        const mouseX = e?.x ?? lastPosition.current.x;
        const mouseY = e?.y ?? lastPosition.current.y;
        if (e) lastPosition.current = { x: mouseX, y: mouseY };

        const center = [left + width * 0.5, top + height * 0.5];
        const distanceFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
        const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;
        if (distanceFromCenter < inactiveRadius) {
          element.style.setProperty("--active", "0");
          return;
        }

        const isActive =
          mouseX > left - proximity &&
          mouseX < left + width + proximity &&
          mouseY > top - proximity &&
          mouseY < top + height + proximity;
        element.style.setProperty("--active", isActive ? "1" : "0");
        if (!isActive) return;

        const currentAngle = parseFloat(element.style.getPropertyValue("--start")) || 0;
        const targetAngle = (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
        const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
        animate(currentAngle, currentAngle + angleDiff, {
          duration: movementDuration,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (value) => element.style.setProperty("--start", String(value)),
        });
      });
    },
    [inactiveZone, proximity, movementDuration],
  );

  useEffect(() => {
    if (off) return;
    const handleScroll = () => handleMove();
    // Mouse and pen only: a finger dragging to scroll shouldn't paint glows.
    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") handleMove(e);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.body.addEventListener("pointermove", handlePointerMove, { passive: true });
    const element = containerRef.current;
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      element?.style.setProperty("--active", "0");
      window.removeEventListener("scroll", handleScroll);
      document.body.removeEventListener("pointermove", handlePointerMove);
    };
  }, [handleMove, off]);

  // Rendered either way, so the server and the first client render match. Off, it never lights.
  return (
    <div
      aria-hidden
      ref={containerRef}
      style={
        {
          "--blur": `${blur}px`,
          "--spread": spread,
          "--start": "0",
          "--active": "0",
          "--glowingeffect-border-width": `${borderWidth}px`,
          "--gradient": GRADIENT,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] contrast-more:hidden forced-colors:hidden",
        blur > 0 && "blur-[var(--blur)]",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[inherit]",
          'after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))] after:rounded-[inherit] after:content-[""]',
          "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
          "after:[background:var(--gradient)] after:[background-attachment:fixed]",
          "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
          "after:[mask-clip:padding-box,border-box]",
          "after:[mask-composite:intersect]",
          "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
        )}
      />
    </div>
  );
});
