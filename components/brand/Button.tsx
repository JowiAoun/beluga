import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const BASE =
  "group relative inline-flex items-center justify-center gap-2 rounded-md font-display font-extrabold tracking-[0.01em] uppercase transition-[background-color,border-color,color] duration-300 ease-water disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-foreground hover:text-background",
  secondary:
    "border border-line-strong text-foreground hover:border-foreground hover:bg-foreground hover:text-background",
  ghost: "text-foreground hover:bg-foreground/10",
  danger: "bg-danger text-white hover:bg-red-700",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

// The label rolls up and a copy rolls in from below on hover or keyboard focus. The copy is
// hidden from screen readers, and with reduced motion nothing rolls.
export function Roll({ children, className }: { children: React.ReactNode; className?: string }) {
  const move =
    "transition-transform duration-600 ease-out-expo motion-reduce:transition-none";
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-[inherit] motion-safe:group-hover:-translate-y-full motion-safe:group-focus-visible:-translate-y-full",
          move,
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 inline-flex translate-y-full items-center gap-[inherit] motion-safe:group-hover:translate-y-0 motion-safe:group-focus-visible:translate-y-0 motion-reduce:hidden",
          move,
        )}
      >
        {children}
      </span>
    </span>
  );
}

type Own = { variant?: Variant; size?: Size; roll?: boolean };
type LinkProps = React.ComponentProps<typeof Link> & Own;

// Internal links go through next/link. Pass `external` for other sites.
export function ButtonLink({ variant, size, roll = true, className, children, ...props }: LinkProps) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props}>
      {roll ? <Roll className="gap-2">{children}</Roll> : children}
    </Link>
  );
}

export function ButtonAnchor({
  variant,
  size,
  roll = true,
  className,
  children,
  ...props
}: React.ComponentProps<"a"> & Own) {
  return (
    <a className={buttonClass({ variant, size, className })} {...props}>
      {roll ? <Roll className="gap-2">{children}</Roll> : children}
    </a>
  );
}

export function Button({
  variant,
  size,
  roll = true,
  className,
  type = "button",
  children,
  ...props
}: React.ComponentProps<"button"> & Own) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {roll ? <Roll className="gap-2">{children}</Roll> : children}
    </button>
  );
}
