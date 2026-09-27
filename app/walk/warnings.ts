// The kinds of warning the user can turn off in Settings. A named object that is off still warns
// as a plain obstacle when there is depth, because it is still in the way: only its own sound and
// name go. In camera-only mode the detector is the only source, so it goes quiet. Drop-offs and
// head-height hazards come from depth alone, so turning one off silences it, sound and vibration.

import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass, HazardKind } from "@/lib/shared/enums";
import { defaultWarnFromM, WARN_FROM } from "@/lib/shared/params";

export type WarningId = "bikes" | "vehicles" | "people" | "poles" | "furniture" | "drop_off" | "head_height";

export interface WarningGroup {
  id: WarningId;
  name: string;
  // How it sounds, in the words the practice page uses.
  sound: string;
  // Named objects: the detector classes in the group.
  labels?: readonly DetectorClass[];
  // Depth warnings: the hazard kind.
  kind?: HazardKind;
}

export const OBJECT_WARNINGS: readonly WarningGroup[] = [
  { id: "bikes", name: "Bikes and motorcycles", sound: "Double bell, says “bike”", labels: ["bicycle", "motorcycle"] },
  { id: "vehicles", name: "Cars, buses and trucks", sound: "Brief buzz, says “car”", labels: ["car", "bus", "truck"] },
  { id: "people", name: "People", sound: "Soft marimba", labels: ["person"] },
  {
    id: "poles",
    name: "Poles, hydrants and stop signs",
    sound: "Metal ping, says “pole”",
    labels: ["pole_like", "fire_hydrant", "stop_sign"],
  },
  {
    id: "furniture",
    name: "Benches, chairs, plants and bags",
    sound: "Wooden tick",
    labels: ["bench", "chair", "potted_plant", "suitcase"],
  },
];

export const DEPTH_WARNINGS: readonly WarningGroup[] = [
  { id: "drop_off", name: "Drop-offs and edges", sound: "Falling tone, says “edge”", kind: "drop_off" },
  { id: "head_height", name: "Things at head height", sound: "Two rising notes, says “head”", kind: "head_height" },
];

export const WARNING_GROUPS: readonly WarningGroup[] = [...OBJECT_WARNINGS, ...DEPTH_WARNINGS];
export const WARNING_IDS: readonly WarningId[] = WARNING_GROUPS.map((g) => g.id);

// The ids from storage that still exist, once each, in the order of the list.
export function cleanWarningsOff(saved: unknown): WarningId[] {
  if (!Array.isArray(saved)) return [];
  return WARNING_IDS.filter((id) => saved.includes(id));
}

// What the user hears and feels, once the warnings they turned off are taken out. `depth` is false
// in camera-only mode.
export function heardHazards(hazards: HazardUpdate[], off: readonly WarningId[], depth: boolean): HazardUpdate[] {
  if (off.length === 0) return hazards;
  const kinds = new Set<HazardKind>();
  const labels = new Set<DetectorClass>();
  for (const group of WARNING_GROUPS) {
    if (!off.includes(group.id)) continue;
    if (group.kind) kinds.add(group.kind);
    group.labels?.forEach((label) => labels.add(label));
  }
  const heard: HazardUpdate[] = [];
  for (const hazard of hazards) {
    if (kinds.has(hazard.kind)) continue;
    if (hazard.kind === "obstacle" && labels.has(hazard.label)) {
      if (depth) heard.push({ ...hazard, label: "unknown" });
      continue;
    }
    heard.push(hazard);
  }
  return heard;
}

// "Bikes and motorcycles, drop-offs and edges", for the start screen.
export function offText(off: readonly WarningId[]): string {
  return WARNING_GROUPS.filter((g) => off.includes(g.id))
    .map((g, i) => (i === 0 ? g.name : g.name.toLowerCase()))
    .join(", ");
}

// Each kind of warning has its own warning distance, a slider in Settings: the groups above, and
// everything beluga can't name (walls, boxes), which is always on.
export type DistanceId = WarningId | "obstacles";
export type WarnFromM = Record<DistanceId, number>;

export const DISTANCE_IDS: readonly DistanceId[] = [...WARNING_IDS, "obstacles"];

function kindOf(id: DistanceId): HazardKind {
  return WARNING_GROUPS.find((g) => g.id === id)?.kind ?? "obstacle";
}

export function defaultWarnFrom(): WarnFromM {
  return Object.fromEntries(DISTANCE_IDS.map((id) => [id, defaultWarnFromM(kindOf(id))])) as WarnFromM;
}

// The top of a slider: as far as that kind of hazard is found.
export function warnFromMax(id: DistanceId): number {
  return kindOf(id) === "drop_off" ? WARN_FROM.dropOffMaxM : WARN_FROM.maxM;
}

// Distances from storage, each kept in range and on a slider step. Anything missing takes its default.
export function cleanWarnFrom(saved: unknown): WarnFromM {
  const out = defaultWarnFrom();
  if (!saved || typeof saved !== "object") return out;
  for (const id of DISTANCE_IDS) {
    const value = (saved as Record<string, unknown>)[id];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const stepped = Math.round(value / WARN_FROM.stepM) * WARN_FROM.stepM;
    out[id] = Math.min(warnFromMax(id), Math.max(WARN_FROM.minM, stepped));
  }
  return out;
}

// Which slider a hazard follows. A named object turned off counts as a plain obstacle, since that
// is how it still warns.
export function distanceIdOf(hazard: Pick<HazardUpdate, "kind" | "label">): DistanceId {
  if (hazard.kind === "drop_off") return "drop_off";
  if (hazard.kind === "head_height") return "head_height";
  return OBJECT_WARNINGS.find((g) => g.labels?.includes(hazard.label))?.id ?? "obstacles";
}

export function warnFromOf(warnFrom: WarnFromM): (hazard: HazardUpdate) => number {
  return (hazard) => warnFrom[distanceIdOf(hazard)];
}
