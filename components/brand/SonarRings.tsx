import { cn } from "@/lib/utils";

// Circles that grow out of a point and fade, like a beluga's echolocation. Decoration only.
// With reduced motion they stand still as three faint circles. Pause motion freezes them.
export function SonarRings({
  className,
  count = 3,
  duration = 3.6,
  colour = "var(--sonar)",
}: {
  className?: string;
  count?: number;
  duration?: number;
  colour?: string;
}) {
  return (
    <span aria-hidden className={cn("pointer-events-none absolute block", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 block size-full rounded-full border-2 opacity-(--still-opacity) [transform:translate(-50%,-50%)_scale(var(--still-scale))] motion-safe:animate-ring motion-safe:opacity-0"
          style={
            {
              borderColor: colour,
              animationDuration: `${duration}s`,
              animationDelay: `${(i * duration) / count}s`,
              "--still-scale": (i + 1) / count,
              "--still-opacity": 0.5 - (i * 0.35) / count,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
