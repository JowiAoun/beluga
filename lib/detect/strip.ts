// Yellow edge strips (Phase 10 stretch): the bright safety-yellow band along a platform edge, or a
// taped line on the floor. In the lower third of the detector's small frame, count yellow pixels. A
// wide band covering more than about 8% of that region, 3 frames in a row, warns like a drop-off
// ("edge"), at the distance where the band's near side meets the floor. It only sees colour, so it
// is always a second signal: when depth already has a drop-off there, depth's warning plays.

import type { HazardUpdate } from "@/lib/shared/contracts";
import { SENSING, TACTILE } from "@/lib/shared/params";
import type { SmallImage } from "@/lib/xr/cameraImage";
import { rayToHeight } from "@/lib/xr/geometry";
import type { SensingUpdate } from "@/lib/xr/types";

export interface StripSighting {
  // Share of the lower third that is yellow.
  share: number;
  // Band centre across the frame, 0 left to 1 right.
  u: number;
  // The band's lowest row, 0 top to 1 bottom: its near side on the floor.
  near: number;
  // Band width as a share of the frame's width.
  width: number;
}

// Safety yellow in hue, saturation and value, without a full HSV conversion per pixel.
function isYellow(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < TACTILE.minValue * 255 || max - min < TACTILE.minSaturation * max) return false;
  // Yellow sits between red and green, well above blue.
  if (b === max) return false;
  const hue = r === max ? 60 * ((g - b) / (max - min)) : 60 * (2 + (b - r) / (max - min));
  return hue >= TACTILE.hueDeg.min && hue <= TACTILE.hueDeg.max;
}

// Looks for a wide yellow band in the lower third of the frame. Null when there is none.
export function findStrip(image: SmallImage): StripSighting | null {
  const { width, height, data } = image;
  const top = Math.floor((height * 2) / 3);
  let total = 0;
  let bandRows = 0;
  let near = -1;
  let left = width;
  let right = -1;
  let sumX = 0;
  let bandPixels = 0;
  for (let y = top; y < height; y++) {
    let count = 0;
    let rowLeft = width;
    let rowRight = -1;
    let rowSumX = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!isYellow(data[i], data[i + 1], data[i + 2])) continue;
      count++;
      rowSumX += x;
      if (x < rowLeft) rowLeft = x;
      rowRight = x;
    }
    total += count;
    // A row counts toward the band when yellow crosses a good part of it.
    if (count < TACTILE.minRowShare * width) continue;
    bandRows++;
    near = y;
    left = Math.min(left, rowLeft);
    right = Math.max(right, rowRight);
    sumX += rowSumX;
    bandPixels += count;
  }
  const share = total / (width * (height - top));
  if (share < TACTILE.minShare || bandRows === 0) return null;
  const bandWidth = (right - left + 1) / width;
  if (bandWidth < TACTILE.minWidth) return null;
  return { share, u: sumX / bandPixels / width, near: (near + 1) / height, width: bandWidth };
}

// A strip warns only after TACTILE.framesInARow frames that each see one.
export class StripTracker {
  private streak = 0;
  private last: StripSighting | null = null;

  update(sighting: StripSighting | null): void {
    this.streak = sighting ? this.streak + 1 : 0;
    this.last = sighting;
  }

  reset(): void {
    this.update(null);
  }

  active(): StripSighting | null {
    return this.streak >= TACTILE.framesInARow ? this.last : null;
  }

  stats(): { streak: number; last: StripSighting | null } {
    return { streak: this.streak, last: this.last };
  }
}

// The strip as a drop-off-priority hazard in this update's view, or null when the band's near side
// doesn't meet the floor within drop-off range.
export function stripHazard(sighting: StripSighting, update: SensingUpdate, since: number): HazardUpdate | null {
  const at = rayToHeight(
    sighting.u,
    Math.min(sighting.near, 1),
    update.floorY,
    update.camera,
    update.worldFromView,
    update.projection,
  );
  if (!at) return null;
  const dx = at.x - update.camera.x;
  const dz = at.z - update.camera.z;
  const ahead = dx * update.forward.x + dz * update.forward.z;
  const lateral = dx * update.right.x + dz * update.right.z;
  if (ahead <= 0 || ahead > SENSING.dropOffAheadMaxM) return null;
  return {
    id: "strip",
    kind: "drop_off",
    distance: ahead,
    angle: (Math.atan2(lateral, ahead) * 180) / Math.PI,
    label: "unknown",
    blocking: Math.min(1, sighting.width),
    active: true,
    firstSeenAt: since,
    updatedAt: update.t,
  };
}

// Adds the strip to the hazards the sounds play, unless depth already has a drop-off near it.
// Drop-offs come first, nearest first, as the hazard engine orders them.
export function withStrip(hazards: HazardUpdate[], strip: HazardUpdate | null): HazardUpdate[] {
  if (!strip) return hazards;
  const covered = hazards.some(
    (h) => h.kind === "drop_off" && Math.abs(h.distance - strip.distance) <= TACTILE.depthCoversM,
  );
  if (covered) return hazards;
  const drops = hazards.filter((h) => h.kind === "drop_off");
  const rest = hazards.filter((h) => h.kind !== "drop_off");
  return [...[...drops, strip].sort((a, b) => a.distance - b.distance), ...rest];
}
