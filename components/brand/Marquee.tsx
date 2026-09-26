import { cn } from "@/lib/utils";

// Big words sliding sideways. Decoration only: every word is also on the page as text. It
// stands still with reduced motion, and Pause motion stops it.
export function Marquee({ items, className, seconds = 45 }: { items: string[]; className?: string; seconds?: number }) {
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <span className={cn("px-[0.3em] whitespace-nowrap", i % 2 === 1 && "font-serif font-normal tracking-[-0.01em]")}>
            {item}
          </span>
          <span className="size-[0.28em] rounded-full border-[0.07em] border-current" />
        </span>
      ))}
    </div>
  );
  return (
    <div aria-hidden className={cn("overflow-hidden select-none", className)}>
      <div className="flex w-max motion-safe:animate-drift" style={{ animationDuration: `${seconds}s` }}>
        {row}
        {row}
      </div>
    </div>
  );
}
