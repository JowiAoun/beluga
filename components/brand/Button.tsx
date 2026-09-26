import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const BASE =
  "group relative inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-[transform,background-color,box-shadow,border-color] duration-150 ease-water active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-background shadow-[0_0_0_0_rgb(253_224_71/0)] hover:shadow-[0_0_40px_-4px_rgb(253_224_71/0.55)] contrast-more:shadow-none",
  secondary: "border border-line bg-surface text-foreground hover:border-white/30 hover:bg-white/10",
  ghost: "text-foreground hover:bg-white/10",
  danger: "bg-danger text-white hover:bg-red-700",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type LinkProps = React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

// Internal links go through next/link. Pass `external` for other sites.
export function ButtonLink({ variant, size, className, ...props }: LinkProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonAnchor({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<"a"> & { variant?: Variant; size?: Size }) {
  return <a className={buttonClass({ variant, size, className })} {...props} />;
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
