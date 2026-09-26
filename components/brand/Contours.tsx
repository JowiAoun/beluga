import { cn } from "@/lib/utils";

// Depth contours, like a sonar map of the sea floor. A mask over a block of the line colour,
// so the lines follow the section's tone. Decoration only.
export function Contours({ variant = "a", className }: { variant?: "a" | "b"; className?: string }) {
  const url = `url(/textures/contours-${variant}.svg)`;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 bg-line contrast-more:hidden forced-colors:hidden", className)}
      style={{
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "cover",
        WebkitMaskSize: "cover",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
