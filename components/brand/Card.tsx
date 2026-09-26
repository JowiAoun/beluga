import { cn } from "@/lib/utils";

// Flat and square, with a hairline border. With more contrast the border gets stronger.
export const CARD = "relative border border-line bg-surface contrast-more:border-foreground/70";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(CARD, "p-6", className)} {...props} />;
}
