// Camera-only mode (Phase 10): hazards from detector boxes alone, for a phone that loses depth.
// A box's bottom edge is where the thing meets the floor, so a ray through it to the floor plane
// gives its spot. When the frame cuts the bottom off (a level chest phone doesn't see the floor
// within about 1.7 m), the top edge and the thing's usual height give it instead, but never
// farther than the frame's bottom edge reaches on the floor.
// Only things the detector can name make a sound, and there are no drop-off or head-height
// warnings: those need depth. Pure logic, like the depth engine, so tests run it without a phone.

import type { Detection } from "@/lib/detect/detections";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { DetectorClass } from "@/lib/shared/enums";
import { CAMERA_ONLY, CAMERA_ONLY_HEIGHTS_M, SENSING } from "@/lib/shared/params";
import { rayToHeight } from "@/lib/xr/geometry";
import type { SensingUpdate, Vec3 } from "@/lib/xr/types";
import { priorityOf, type EngineResult, type HazardEvent } from "./engine";

// A box placed on the floor, inside the corridor.
export interface Spot {
  label: DetectorClass;
  world: Vec3;
  ahead: number;
  lateral: number;
  // Share of the corridor's width the box covers, 0 to 1.
  blocking: number;
}

interface Track {
  id: string;
  label: DetectorClass;
  world: Vec3;
  blocking: number;
  streak: number;
  active: boolean;
  firstSeenAt: number;
  seenAt: number;
  nearMissSent: boolean;
}

function relative(world: Vec3, update: SensingUpdate): { ahead: number; lateral: number } {
  const dx = world.x - update.camera.x;
  const dz = world.z - update.camera.z;
  return {
    ahead: dx * update.forward.x + dz * update.forward.z,
    lateral: dx * update.right.x + dz * update.right.z,
  };
}

// Places a box at one image row, on the level plane at height y: its left and right edges on that
// row give its spot and width. Null outside the corridor, or when the row never meets the plane.
function place(detection: Detection, row: number, y: number, update: SensingUpdate): Spot | null {
  const { camera, worldFromView, projection } = update;
  const left = rayToHeight(detection.box.left, row, y, camera, worldFromView, projection);
  const right = rayToHeight(detection.box.right, row, y, camera, worldFromView, projection);
  if (!left || !right) return null;
  const a = relative(left, update);
  const b = relative(right, update);
  const ahead = (a.ahead + b.ahead) / 2;
  if (ahead <= 0 || ahead > SENSING.corridorAheadMaxM) return null;
  const half = SENSING.corridorHalfWidthM;
  const from = Math.max(Math.min(a.lateral, b.lateral), -half);
  const to = Math.min(Math.max(a.lateral, b.lateral), half);
  if (to <= from) return null;
  // The sound comes from the part inside the corridor.
  const lateral = (from + to) / 2;
  const world = {
    x: camera.x + ahead * update.forward.x + lateral * update.right.x,
    y,
    z: camera.z + ahead * update.forward.z + lateral * update.right.z,
  };
  return { label: detection.label, world, ahead, lateral, blocking: (to - from) / (2 * half) };
}

// Where a detector box stands in the walking corridor, or null when it is outside it or the view
// can't place it (the phone tipped up, so the row never meets the floor).
export function spotOf(detection: Detection, update: SensingUpdate): Spot | null {
  const { box, label } = detection;
  if (box.bottom < CAMERA_ONLY.cutOffEdge) return place(detection, box.bottom, update.floorY, update);
  // Cut off at the bottom, so closer than the frame's bottom edge reaches on the floor.
  const reach = place(detection, 1, update.floorY, update);
  const height = CAMERA_ONLY_HEIGHTS_M[label];
  const byTop =
    height !== undefined && box.top > 1 - CAMERA_ONLY.cutOffEdge
      ? place(detection, box.top, update.floorY + height, update)
      : null;
  if (!reach || !byTop) return reach ?? byTop;
  return byTop.ahead < reach.ahead ? byTop : reach;
}

function angleOf(ahead: number, lateral: number): number {
  return (Math.atan2(lateral, ahead) * 180) / Math.PI;
}

export class CameraOnlyEngine {
  private tracks: Track[] = [];
  private nextId = 1;
  private lastDetections: Detection[] | null = null;

  reset(): void {
    this.tracks = [];
    this.lastDetections = null;
  }

  // `detections` is the detector's latest result. A new array means a new result; the same one
  // again only moves the tracks with the walker.
  update(update: SensingUpdate, detections: Detection[]): EngineResult {
    if (!update.tracking) return { hazards: [], events: [], floor: null };
    const t = update.t;
    if (detections !== this.lastDetections) {
      this.lastDetections = detections;
      this.match(detections, update);
    }

    const events: HazardEvent[] = [];
    const hazards: HazardUpdate[] = [];
    this.tracks = this.tracks.filter((track) => t - track.seenAt <= CAMERA_ONLY.holdMs);
    for (const track of this.tracks) {
      const at = relative(track.world, update);
      // Passed it.
      if (at.ahead <= 0) {
        track.seenAt = -Infinity;
        continue;
      }
      const activates = !track.active && track.streak >= CAMERA_ONLY.activateAfterBoxes;
      if (activates) track.active = true;
      if (!track.active) continue;
      const hazard: HazardUpdate = {
        id: track.id,
        kind: "obstacle",
        distance: at.ahead,
        angle: angleOf(at.ahead, at.lateral),
        label: track.label,
        blocking: track.blocking,
        active: true,
        firstSeenAt: track.firstSeenAt,
        updatedAt: track.seenAt,
      };
      if (activates) events.push({ type: "hazard_seen", t, hazard });
      if (!track.nearMissSent && track.blocking <= SENSING.nearMissMaxBlocking && at.ahead < SENSING.nearMissDistanceM) {
        track.nearMissSent = true;
        events.push({ type: "near_miss", t, hazard });
      }
      hazards.push(hazard);
    }
    this.tracks = this.tracks.filter((track) => track.seenAt !== -Infinity);
    hazards.sort((a, b) => priorityOf(a) - priorityOf(b) || a.distance - b.distance);
    return { hazards, events, floor: null };
  }

  // Pairs each new box with the nearest track of its class, closest pairs first.
  private match(detections: Detection[], update: SensingUpdate): void {
    const t = update.t;
    const spots = detections.map((d) => spotOf(d, update)).filter((s): s is Spot => s !== null);
    const pairs: Array<{ track: Track; spot: Spot; gap: number }> = [];
    for (const track of this.tracks) {
      for (const spot of spots) {
        if (spot.label !== track.label) continue;
        const gap = Math.hypot(spot.world.x - track.world.x, spot.world.z - track.world.z);
        if (gap <= CAMERA_ONLY.matchDistanceM) pairs.push({ track, spot, gap });
      }
    }
    pairs.sort((a, b) => a.gap - b.gap);
    const matched = new Set<Track>();
    const used = new Set<Spot>();
    const w = SENSING.smoothingWeight;
    for (const { track, spot } of pairs) {
      if (matched.has(track) || used.has(spot)) continue;
      matched.add(track);
      used.add(spot);
      track.world = {
        x: w * spot.world.x + (1 - w) * track.world.x,
        y: spot.world.y,
        z: w * spot.world.z + (1 - w) * track.world.z,
      };
      track.blocking = spot.blocking;
      track.streak++;
      track.seenAt = t;
    }
    // A thing not yet sounding needs its boxes in a row.
    this.tracks = this.tracks.filter((track) => track.active || matched.has(track));
    for (const spot of spots) {
      if (used.has(spot)) continue;
      this.tracks.push({
        id: `camera-${spot.label}-${this.nextId++}`,
        label: spot.label,
        world: spot.world,
        blocking: spot.blocking,
        streak: 1,
        active: false,
        firstSeenAt: t,
        seenAt: t,
        nearMissSent: false,
      });
    }
  }
}
