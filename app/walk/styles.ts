import { buttonClass } from "@/components/brand/Button";
import { CARD } from "@/components/brand/Card";
import { cn } from "@/lib/utils";

// The site's buttons, made taller for /walk: 64 px and up, with 20 px text.
const WALK_SIZE = "min-h-16 px-5 text-xl";
export const PRIMARY = buttonClass({ className: WALK_SIZE });
export const SECONDARY = buttonClass({ variant: "secondary", className: WALK_SIZE });
export const DANGER = buttonClass({ variant: "danger", className: WALK_SIZE });

// Setup screens only. The walking screen gets no blur or shadow.
export const PANEL = cn(CARD, "p-5");

// A yellow check, 24 px, for the toggle rows.
export const CHECKBOX = "size-6 shrink-0 accent-accent";

export const SELECT =
  "min-h-16 rounded-2xl border border-line bg-background px-4 text-xl text-foreground contrast-more:border-white/60";

// Links to the other walk pages, in the site's link colour.
export const LINK_ROW =
  "flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 text-xl font-semibold text-sonar hover:border-white/30";
