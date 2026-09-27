// The small switch at the top right of the walking screen for the depth heatmap, and the one-line
// key from near to far under the top row while it is on. The heatmap itself is drawn in heatmap.ts.

import { IconFlame } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { HEATMAP_FAR_M, HEATMAP_STOPS } from "./heatmap";

export default function HeatmapButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "ml-auto grid size-12 shrink-0 place-items-center rounded-md border-2",
        on ? "border-accent bg-accent text-on-accent" : "border-foreground bg-abyss text-foreground",
      )}
    >
      <IconFlame aria-hidden size={26} />
      <span className="sr-only">Depth heatmap</span>
    </button>
  );
}

export function HeatmapKey({ depth }: { depth: boolean }) {
  return (
    <p className="flex items-center gap-3 rounded-md bg-abyss/90 px-3 py-2 font-mono text-sm">
      {depth ? (
        <>
          Near
          <span
            aria-hidden
            className="h-2 flex-1 rounded-full"
            style={{ background: `linear-gradient(to right, ${HEATMAP_STOPS.join(", ")})` }}
          />
          {HEATMAP_FAR_M} m
        </>
      ) : (
        "No depth in camera mode, so the heatmap stays empty."
      )}
    </p>
  );
}
