import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass, SoundId } from "@/lib/shared/enums";

const BELLS: ReadonlySet<DetectorClass> = new Set(["bicycle", "motorcycle"]);
const MOTOR: ReadonlySet<DetectorClass> = new Set(["car", "bus", "truck"]);
const POLES: ReadonlySet<DetectorClass> = new Set(["pole_like", "fire_hydrant", "stop_sign"]);

type SoundQuery = Pick<HazardUpdate, "kind" | "label">;

// The warning sound for a hazard, from the label table in Phase 4. Pitch stands in for height,
// since bone conduction can't place a sound up or down: a high chime for head height, a falling
// tone for a drop-off. `blocked` is set when triage says an obstruction blocks the path.
export function soundFor(hazard: SoundQuery, blocked = false): SoundId {
  if (hazard.kind === "drop_off") return "edge_pulse";
  if (hazard.kind === "head_height") return "head_chime";
  if (blocked) return "taps";
  if (BELLS.has(hazard.label)) return "bell";
  if (MOTOR.has(hazard.label)) return "buzz";
  if (hazard.label === "person") return "marimba";
  if (POLES.has(hazard.label)) return "ping";
  return "tick";
}

// The word spoken once as a hazard comes near, or null for obstacles with no useful name.
export function wordFor(hazard: SoundQuery, blocked = false): string | null {
  if (hazard.kind === "drop_off") return "edge";
  if (hazard.kind === "head_height") return "head";
  if (blocked) return "blocked";
  if (BELLS.has(hazard.label)) return "bike";
  if (MOTOR.has(hazard.label)) return "car";
  if (POLES.has(hazard.label)) return "pole";
  return null;
}
