import { cn } from "@/lib/utils";

// Blur only from md up: it slows phones down.
export const CARD =
  "relative rounded-3xl border border-line bg-surface md:backdrop-blur-md contrast-more:border-white/60 contrast-more:bg-background";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(CARD, "p-6", className)} {...props} />;
}
