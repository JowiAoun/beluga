import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass, SoundId } from "@/lib/shared/enums";
import { SENSING } from "@/lib/shared/params";

const BELLS: ReadonlySet<DetectorClass> = new Set(["bicycle", "motorcycle"]);
const MOTOR: ReadonlySet<DetectorClass> = new Set(["car", "bus", "truck"]);

type SoundQuery = Pick<HazardUpdate, "kind" | "label" | "blocking">;

// The warning sound for a hazard. Pitch stands in for height, since bone conduction can't place
// a sound up or down: a high chime for head height, a falling tone for a drop-off.
export function soundFor(hazard: SoundQuery): SoundId {
  if (hazard.kind === "drop_off") return "edge_pulse";
  if (hazard.kind === "head_height") return "head_chime";
  if (BELLS.has(hazard.label)) return "bell";
  if (MOTOR.has(hazard.label)) return "buzz";
  if (hazard.label === "person") return "marimba";
  if (hazard.blocking >= SENSING.blockedMinBlocking) return "taps";
  if (hazard.label === "pole_like") return "ping";
  return "tick";
}

// The word spoken once as a hazard comes near, or null for obstacles with no useful name.
export function wordFor(hazard: SoundQuery): string | null {
  if (hazard.kind === "drop_off") return "edge";
  if (hazard.kind === "head_height") return "head";
  if (BELLS.has(hazard.label)) return "bike";
  if (MOTOR.has(hazard.label)) return "car";
  if (hazard.label === "person") return "person";
  if (hazard.blocking >= SENSING.blockedMinBlocking) return "blocked";
  if (hazard.label === "pole_like") return "pole";
  return null;
}
