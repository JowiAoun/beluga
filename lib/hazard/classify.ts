import type { HazardKind } from "@/lib/shared/enums";
import { SENSING, headHeightTopM } from "@/lib/shared/params";
import type { SensingUpdate, Vec3 } from "@/lib/xr/types";
import { fitFloorLine, type FloorLine } from "./floorLine";

// One hazard found in a single update, before smoothing.
export interface RawHazard {
  kind: HazardKind;
  // Bucket of the hazard's middle: 0 far left to 4 far right.
  bucket: number;
  // Metres ahead to the nearest point, and metres right of the walking line to the middle of the
  // nearest points. On a wall every point is about as near, so the middle keeps it straight ahead.
  ahead: number;
  lateral: number;
  // Share of the corridor width covered, 0 to 1.
  blocking: number;
  poleLike: boolean;
  // That spot in the world, so the hazard can be followed after it leaves the view. Its height is
  // the part of the hazard that stays in view longest: the top of an obstacle (the view's bottom
  // edge cuts low things first), the bottom of a head-height board, the floor at a drop's edge.
  world: Vec3;
}

export interface Findings {
  hazards: RawHazard[];
  floor: FloorLine;
}

const BUCKET_WIDTH_M = (2 * SENSING.corridorHalfWidthM) / SENSING.lateralBuckets;
const KINDS: HazardKind[] = ["obstacle", "head_height", "drop_off"];

export function bucketOf(lateral: number): number {
  const b = Math.floor((lateral + SENSING.corridorHalfWidthM) / BUCKET_WIDTH_M);
  return Math.min(SENSING.lateralBuckets - 1, Math.max(0, b));
}

// The nearest dense group of points in one kind and bucket.
interface Hit {
  near: number;
  // Point index of the nearest point.
  index: number;
  count: number;
  lateralSum: number;
  minLateral: number;
  maxLateral: number;
  minHeight: number;
  maxHeight: number;
}

// The nearest point that has enough others close behind it, so stray depth points don't count.
function hitFrom(indices: number[], ahead: Float32Array, lateral: Float32Array, height: Float32Array): Hit | null {
  const n = SENSING.minPointsPerHit;
  if (indices.length < n) return null;
  indices.sort((a, b) => ahead[a] - ahead[b]);
  for (let s = 0; s + n - 1 < indices.length; s++) {
    const near = ahead[indices[s]];
    if (ahead[indices[s + n - 1]] - near > SENSING.bucketMergeDistanceM) continue;
    const hit: Hit = {
      near,
      index: indices[s],
      count: 0,
      lateralSum: 0,
      minLateral: Infinity,
      maxLateral: -Infinity,
      minHeight: Infinity,
      maxHeight: -Infinity,
    };
    for (let k = s; k < indices.length && ahead[indices[k]] - near <= SENSING.bucketMergeDistanceM; k++) {
      const i = indices[k];
      hit.count++;
      hit.lateralSum += lateral[i];
      hit.minLateral = Math.min(hit.minLateral, lateral[i]);
      hit.maxLateral = Math.max(hit.maxLateral, lateral[i]);
      hit.minHeight = Math.min(hit.minHeight, height[i]);
      hit.maxHeight = Math.max(hit.maxHeight, height[i]);
    }
    return hit;
  }
  return null;
}

// Classifies every depth point in the walking corridor and groups them into hazards.
export function findHazards(update: SensingUpdate, headTopM: number = headHeightTopM()): Findings {
  const { points, camera, forward, right, floorY } = update;
  const count = points.length / 3;
  const ahead = new Float32Array(count);
  const lateral = new Float32Array(count);
  const height = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const dx = points[i * 3] - camera.x;
    const dz = points[i * 3 + 2] - camera.z;
    ahead[i] = dx * forward.x + dz * forward.z;
    lateral[i] = dx * right.x + dz * right.z;
    height[i] = points[i * 3 + 1] - floorY;
  }

  // Heights from here on are above the fitted line, so ramps stay walkable.
  const floor = fitFloorLine(ahead, lateral, height);
  const buckets = SENSING.lateralBuckets;
  const lists: number[][][] = KINDS.map(() => Array.from({ length: buckets }, () => []));
  const floorLists: number[][] = Array.from({ length: buckets }, () => []);

  for (let i = 0; i < count; i++) {
    const a = ahead[i];
    if (a < SENSING.corridorAheadMinM || Math.abs(lateral[i]) > SENSING.corridorHalfWidthM) continue;
    const h = height[i] - (floor.intercept + floor.slope * a);
    height[i] = h;
    const b = bucketOf(lateral[i]);
    if (h < -SENSING.dropOffBelowFloorM) {
      if (a <= SENSING.dropOffAheadMaxM) lists[2][b].push(i);
    } else if (h <= SENSING.floorBandM.high) {
      if (a <= SENSING.dropOffAheadMaxM) floorLists[b].push(i);
    } else if (a <= SENSING.corridorAheadMaxM) {
      if (h <= SENSING.headHeightBottomM) lists[0][b].push(i);
      else if (h <= headTopM) lists[1][b].push(i);
      // Above the head-height top: overhead, ignored.
    }
  }

  const hits = lists.map((kind) => kind.map((indices) => hitFrom(indices, ahead, lateral, height)));

  for (let b = 0; b < buckets; b++) {
    // Something at head height with an obstacle under it (a pole, a person, a wall) is one the cane
    // finds, so only the obstacle counts. Head-height hazards are the ones with nothing below.
    const head = hits[1][b];
    const below = hits[0][b];
    if (head && below && below.near <= head.near + SENSING.bucketMergeDistanceM) hits[1][b] = null;

    // A drop-off is where the floor ends. From chest height the lower floor only shows further out,
    // so the last floor point before it marks the edge.
    const drop = hits[2][b];
    if (drop) {
      let edge = -1;
      for (const i of floorLists[b]) {
        if (ahead[i] < drop.near && (edge < 0 || ahead[i] > ahead[edge])) edge = i;
      }
      if (edge >= 0) {
        drop.near = ahead[edge];
        drop.index = edge;
      }
    }
  }

  const hazards: RawHazard[] = [];
  KINDS.forEach((kind, k) => {
    let group: Array<{ bucket: number; hit: Hit }> = [];
    const flush = () => {
      if (group.length > 0) hazards.push(toHazard(kind, group, update, floor));
      group = [];
    };
    for (let b = 0; b < buckets; b++) {
      const hit = hits[k][b];
      if (!hit) {
        flush();
        continue;
      }
      const previous = group[group.length - 1];
      if (previous && Math.abs(hit.near - previous.hit.near) > SENSING.bucketMergeDistanceM) flush();
      group.push({ bucket: b, hit });
    }
    flush();
  });

  return { hazards, floor };
}

function toHazard(
  kind: HazardKind,
  group: Array<{ bucket: number; hit: Hit }>,
  update: SensingUpdate,
  floor: FloorLine,
): RawHazard {
  const nearest = group.reduce((a, b) => (b.hit.near < a.hit.near ? b : a));
  let count = 0;
  let lateralSum = 0;
  let minLateral = Infinity;
  let maxLateral = -Infinity;
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  for (const { hit } of group) {
    minLateral = Math.min(minLateral, hit.minLateral);
    maxLateral = Math.max(maxLateral, hit.maxLateral);
    minHeight = Math.min(minHeight, hit.minHeight);
    maxHeight = Math.max(maxHeight, hit.maxHeight);
    if (hit.near > nearest.hit.near + SENSING.bucketMergeDistanceM) continue;
    count += hit.count;
    lateralSum += hit.lateralSum;
  }
  const ahead = nearest.hit.near;
  const lateral = lateralSum / count;
  const { camera, forward, right } = update;
  let height = 0;
  if (kind === "obstacle") height = maxHeight;
  else if (kind === "head_height") height = minHeight;
  return {
    kind,
    bucket: bucketOf(lateral),
    ahead,
    lateral,
    blocking: group.length / SENSING.lateralBuckets,
    poleLike:
      kind === "obstacle" &&
      maxLateral - minLateral < BUCKET_WIDTH_M &&
      maxHeight - minHeight > SENSING.poleLikeMinHeightSpanM,
    world: {
      x: camera.x + forward.x * ahead + right.x * lateral,
      y: update.floorY + floor.intercept + floor.slope * ahead + height,
      z: camera.z + forward.z * ahead + right.z * lateral,
    },
  };
}
