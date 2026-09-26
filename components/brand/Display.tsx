import { cn } from "@/lib/utils";

// Heavy uppercase headings. The source stays in sentence case, so screen readers and the
// copy rules see normal text, and CSS makes it uppercase.
export const DISPLAY = "font-display font-extrabold uppercase text-balance";

// The thin serif for the words a heading leans on, in the soft blue.
export function Serif({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-serif font-normal tracking-[-0.01em] text-sonar", className)}>{children}</span>;
}

// The name is always lowercase, even inside an uppercase heading or button.
export function Name({ className }: { className?: string }) {
  return <span className={cn("normal-case", className)}>beluga</span>;
}

// The small label over a section heading.
export function Eyebrow({
  children,
  icon,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 font-display text-sm font-bold tracking-[0.08em] text-sonar uppercase", className)}>
      {icon}
      {children}
    </p>
  );
}
