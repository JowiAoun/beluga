import { SENSING, headHeightTopM } from "@/lib/shared/params";
import type { SensingUpdate } from "@/lib/xr/types";

// A point in the walking frame: metres ahead along the walking direction, to the right of it,
// and above the floor.
export interface CorridorPoint {
  ahead: number;
  lateral: number;
  height: number;
}

export function toCorridor(x: number, y: number, z: number, update: SensingUpdate, out: CorridorPoint): CorridorPoint {
  const dx = x - update.camera.x;
  const dz = z - update.camera.z;
  out.ahead = dx * update.forward.x + dz * update.forward.z;
  out.lateral = dx * update.right.x + dz * update.right.z;
  out.height = y - update.floorY;
  return out;
}

// Distance ahead to the nearest thing in the walking corridor, between the top of the floor band
// and the head-height top. Takes the Nth nearest point (N = minPointsPerHit), so a few stray depth
// points don't count. Null when nothing is there.
export function nearestAhead(
  update: SensingUpdate,
  maxAheadM: number = SENSING.corridorAheadMaxM,
  headTopM: number = headHeightTopM(),
): number | null {
  const n = SENSING.minPointsPerHit;
  // The n smallest distances so far, largest last.
  const nearest: number[] = [];
  const p: CorridorPoint = { ahead: 0, lateral: 0, height: 0 };
  const { points } = update;
  for (let i = 0; i < points.length; i += 3) {
    toCorridor(points[i], points[i + 1], points[i + 2], update, p);
    if (p.ahead < SENSING.corridorAheadMinM || p.ahead > maxAheadM) continue;
    if (Math.abs(p.lateral) > SENSING.corridorHalfWidthM) continue;
    if (p.height <= SENSING.floorBandM.high || p.height > headTopM) continue;
    if (nearest.length === n && p.ahead >= nearest[n - 1]) continue;
    let at = nearest.length === n ? n - 1 : nearest.length;
    while (at > 0 && nearest[at - 1] > p.ahead) {
      nearest[at] = nearest[at - 1];
      at--;
    }
    nearest[at] = p.ahead;
  }
  return nearest.length === n ? nearest[n - 1] : null;
}
