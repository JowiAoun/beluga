import { cn } from "@/lib/utils";

// The outline is drawn by two clipped layers, the border colour and then the section colour
// 1 px inside it, since a real border can't follow the notch.
const CLIP =
  "polygon(0 0, 100% 0, 100% 100%, calc(100% - var(--tab)) 100%, calc(100% - var(--tab) - var(--cut)) calc(100% - var(--cut)), 0 calc(100% - var(--cut)))";

// An outline card with a label tab at the bottom right. With forced colours it falls back to a
// plain border.
export function NotchCard({
  label,
  children,
  className,
  tab = "11rem",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tab?: string;
}) {
  return (
    <div
      className={cn("relative pb-(--cut) [--cut:2rem] forced-colors:border", className)}
      style={{ "--tab": tab } as React.CSSProperties}
    >
      <div aria-hidden className="absolute inset-0 bg-line-strong forced-colors:hidden" style={{ clipPath: CLIP }} />
      <div aria-hidden className="absolute inset-px bg-background forced-colors:hidden" style={{ clipPath: CLIP }} />
      <div className="relative">{children}</div>
      <p className="absolute right-0 bottom-0 flex h-(--cut) w-(--tab) items-center justify-end gap-2 px-4 font-display text-sm font-bold tracking-[0.04em] uppercase">
        {label}
      </p>
    </div>
  );
}
