// Turns each sensing update into stable hazards for the audio, the event queue and the frame gate.
// Pure logic with no browser APIs, so it runs the same on the phone, in replays and in tests.

import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass, HazardKind } from "@/lib/shared/enums";
import { SENSING, USER, headHeightTopM } from "@/lib/shared/params";
import { toViewCoords } from "@/lib/xr/geometry";
import type { SensingUpdate, Vec3 } from "@/lib/xr/types";
import { findHazards, type RawHazard } from "./classify";
import type { FloorLine } from "./floorLine";

export interface HazardEvent {
  type: "hazard_seen" | "near_miss";
  t: number;
  hazard: HazardUpdate;
}

// What label matching (Phase 4) gets to see about a hazard.
export interface LabelQuery {
  id: string;
  kind: HazardKind;
  angle: number;
  distance: number;
  poleLike: boolean;
  // Where the hazard sits across the camera view, 0 at the left edge to 1 at the right; null out of view.
  u: number | null;
}

// The detector's label for a hazard, or null for no match.
export type LabelFor = (hazard: LabelQuery) => DetectorClass | null;

export interface EngineResult {
  // Active hazards, most urgent first. Audio plays the first two.
  hazards: HazardUpdate[];
  events: HazardEvent[];
  // The floor line this update used, for the debug overlay. Null while tracking is lost.
  floor: FloorLine | null;
}

interface Track {
  id: string;
  kind: HazardKind;
  bucket: number;
  world: Vec3;
  distance: number;
  angle: number;
  blocking: number;
  poleLike: boolean;
  label: DetectorClass;
  // Updates in a row with the hazard seen, and without it while in view.
  streak: number;
  misses: number;
  active: boolean;
  firstSeenAt: number;
  updatedAt: number;
  outOfViewSince: number | null;
  nearMissSent: boolean;
}

const VEHICLES: ReadonlySet<DetectorClass> = new Set(["bicycle", "motorcycle", "car", "bus", "truck"]);

// 1 drop-off, 2 head height, 3 vehicle, bike or blocked path, 4 pole or other obstacle, 5 person.
export function priorityOf(hazard: { kind: HazardKind; label: DetectorClass; blocking: number }): number {
  if (hazard.kind === "drop_off") return 1;
  if (hazard.kind === "head_height") return 2;
  if (VEHICLES.has(hazard.label)) return 3;
  if (hazard.label === "person") return 5;
  if (hazard.blocking >= SENSING.blockedMinBlocking) return 3;
  return 4;
}

// Degrees from the walking direction, negative to the left.
function angleOf(ahead: number, lateral: number): number {
  return (Math.atan2(lateral, ahead) * 180) / Math.PI;
}

function relative(world: Vec3, update: SensingUpdate): { ahead: number; lateral: number } {
  const dx = world.x - update.camera.x;
  const dz = world.z - update.camera.z;
  return {
    ahead: dx * update.forward.x + dz * update.forward.z,
    lateral: dx * update.right.x + dz * update.right.z,
  };
}

function inView(world: Vec3, update: SensingUpdate): boolean {
  const at = toViewCoords(world, update.viewFromWorld, update.projection);
  return at !== null && at.u >= 0 && at.u <= 1 && at.v >= 0 && at.v <= 1;
}

function acrossView(world: Vec3, update: SensingUpdate): number | null {
  const at = toViewCoords(world, update.viewFromWorld, update.projection);
  return at !== null && at.u >= 0 && at.u <= 1 ? at.u : null;
}

function toUpdate(track: Track): HazardUpdate {
  return {
    id: track.id,
    kind: track.kind,
    distance: track.distance,
    angle: track.angle,
    label: track.label,
    blocking: track.blocking,
    active: track.active,
    firstSeenAt: track.firstSeenAt,
    updatedAt: track.updatedAt,
  };
}

export class HazardEngine {
  private tracks: Track[] = [];
  private nextId = 1;
  private headTopM: number;

  constructor(userHeightM: number = USER.defaultHeightM) {
    this.headTopM = headHeightTopM(userHeightM);
  }

  setUserHeight(userHeightM: number): void {
    this.headTopM = headHeightTopM(userHeightM);
  }

  reset(): void {
    this.tracks = [];
  }

  update(update: SensingUpdate, labelFor?: LabelFor): EngineResult {
    // Tracking lost: nothing sounds, and every hazard holds still until tracking comes back.
    if (!update.tracking) return { hazards: [], events: [], floor: null };

    const { hazards: raws, floor } = findHazards(update, this.headTopM);
    const t = update.t;
    const events: HazardEvent[] = [];

    // Pair each hazard with the closest track of its kind: one bucket of drift, or the same spot.
    const pairs: Array<{ track: Track; raw: RawHazard; gap: number }> = [];
    for (const track of this.tracks) {
      for (const raw of raws) {
        if (raw.kind !== track.kind) continue;
        const gap = Math.hypot(raw.world.x - track.world.x, raw.world.z - track.world.z);
        if (Math.abs(raw.bucket - track.bucket) > 1 && gap > SENSING.bucketMergeDistanceM) continue;
        pairs.push({ track, raw, gap });
      }
    }
    pairs.sort((a, b) => a.gap - b.gap);
    const matched = new Set<Track>();
    const used = new Set<RawHazard>();
    for (const { track, raw } of pairs) {
      if (matched.has(track) || used.has(raw)) continue;
      matched.add(track);
      used.add(raw);
      const before = relative(track.world, update);
      if (before.ahead > 0 && before.ahead < raw.ahead && !inView(track.world, update)) {
        // The near part has left the view and only the far part still shows (the top of a low box
        // close ahead). Keep the nearer spot, or the distance would stop falling right before impact.
        track.distance = before.ahead;
        track.angle = angleOf(before.ahead, before.lateral);
      } else {
        const w = SENSING.smoothingWeight;
        track.distance = w * raw.ahead + (1 - w) * track.distance;
        track.angle = w * angleOf(raw.ahead, raw.lateral) + (1 - w) * track.angle;
        track.world = raw.world;
      }
      track.bucket = raw.bucket;
      track.blocking = raw.blocking;
      track.poleLike = raw.poleLike;
      track.streak++;
      track.misses = 0;
      track.outOfViewSince = null;
      track.updatedAt = t;
    }

    const kept: Track[] = [];
    for (const track of this.tracks) {
      if (matched.has(track)) {
        kept.push(track);
        continue;
      }
      // A hazard not yet active needs its updates in a row.
      if (!track.active) continue;
      const at = relative(track.world, update);
      track.distance = at.ahead;
      track.angle = angleOf(at.ahead, at.lateral);
      if (at.ahead <= 0) continue;
      if (inView(track.world, update)) {
        track.outOfViewSince = null;
        if (++track.misses >= SENSING.deactivateAfterUpdates) continue;
      } else {
        // Off the edge of the view, a close box would go quiet right when it matters. It keeps
        // sounding from where it was until the user passes it, for a few seconds at most.
        track.outOfViewSince ??= t;
        if (t - track.outOfViewSince > SENSING.outOfViewMemoryMaxMs) continue;
      }
      kept.push(track);
    }

    for (const raw of raws) {
      if (used.has(raw)) continue;
      kept.push({
        id: `${raw.kind}-${raw.bucket}-${this.nextId++}`,
        kind: raw.kind,
        bucket: raw.bucket,
        world: raw.world,
        distance: raw.ahead,
        angle: angleOf(raw.ahead, raw.lateral),
        blocking: raw.blocking,
        poleLike: raw.poleLike,
        label: "unknown",
        streak: 1,
        misses: 0,
        active: false,
        firstSeenAt: t,
        updatedAt: t,
        outOfViewSince: null,
        nearMissSent: false,
      });
    }
    this.tracks = kept;

    const active: Track[] = [];
    for (const track of kept) {
      const activates = !track.active && track.streak >= SENSING.activateAfterUpdates;
      if (activates) track.active = true;
      if (!track.active) continue;
      const fallback: DetectorClass = track.poleLike ? "pole_like" : "unknown";
      track.label =
        labelFor?.({
          id: track.id,
          kind: track.kind,
          angle: track.angle,
          distance: track.distance,
          poleLike: track.poleLike,
          u: acrossView(track.world, update),
        }) ?? fallback;
      if (activates) events.push({ type: "hazard_seen", t, hazard: toUpdate(track) });

      // A wall or a closed door fills the corridor, and walking up to one is not a near-miss.
      // A drop-off across the whole path still is.
      const fillsPath = track.kind === "obstacle" && track.blocking > SENSING.nearMissMaxBlocking;
      if (!track.nearMissSent && !fillsPath && track.distance < SENSING.nearMissDistanceM) {
        track.nearMissSent = true;
        events.push({ type: "near_miss", t, hazard: toUpdate(track) });
      }
      active.push(track);
    }

    const hazards = active
      .map(toUpdate)
      .sort((a, b) => priorityOf(a) - priorityOf(b) || a.distance - b.distance);
    return { hazards, events, floor };
  }
}
