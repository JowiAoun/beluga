import { buttonClass } from "@/components/brand/Button";
import { CARD } from "@/components/brand/Card";
import { cn } from "@/lib/utils";

// The site's buttons, made taller for /walk: 64 px and up, with 20 px text. They keep Atkinson
// in sentence case, since it reads better than the uppercase display font.
const WALK_SIZE = "min-h-16 px-5 text-xl font-sans font-bold normal-case tracking-normal";
export const PRIMARY = buttonClass({ className: WALK_SIZE });
export const SECONDARY = buttonClass({ variant: "secondary", className: WALK_SIZE });
export const DANGER = buttonClass({ variant: "danger", className: WALK_SIZE });

// Setup screens only. Flat and square, like the site's cards.
export const PANEL = cn(CARD, "p-5");

// A blue check, 24 px, for the toggle rows.
export const CHECKBOX = "size-6 shrink-0 accent-accent";

export const SELECT =
  "min-h-16 rounded-md border border-line-strong bg-abyss px-4 text-xl text-foreground contrast-more:border-foreground";

// Links to the other walk pages, in the site's link colour.
export const LINK_ROW =
  "flex min-h-16 items-center justify-between gap-3 rounded-md border border-line-strong bg-surface px-5 text-xl font-semibold text-sonar hover:border-foreground";
