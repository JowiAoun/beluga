import { SENSING } from "@/lib/shared/params";
import type { Flat, FloorSource, Vec3 } from "./types";

export type FloorEvent = "calibration_started" | "calibrated" | "calibration_unavailable";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Heights of the points that could be floor: in the walking path, 0.5 to 2 m ahead, and well below the phone.
export function floorCandidates(points: Float32Array, camera: Vec3, forward: Flat, right: Flat): number[] {
  const { min, max } = SENSING.floorCalibrationAheadM;
  const top = camera.y - SENSING.floorMinBelowCameraM;
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 3) {
    const y = points[i + 1];
    if (y > top) continue;
    const dx = points[i] - camera.x;
    const dz = points[i + 2] - camera.z;
    const ahead = dx * forward.x + dz * forward.z;
    if (ahead < min || ahead > max) continue;
    if (Math.abs(dx * right.x + dz * right.z) > SENSING.corridorHalfWidthM) continue;
    out.push(y);
  }
  return out;
}

// Floor height in the reference space. Chrome's local-floor on a phone is a fixed guess, so this
// starts from the guess, takes its first real value from hit tests against ARCore's floor plane,
// calibrates from depth while the user takes three slow steps, then follows slow drift. When the
// floor under the user moves (stairs, an escalator, or ARCore shifting its world after it lost
// tracking), it moves with it.
export class FloorTracker {
  y: number;
  source: FloorSource = "guess";
  calibrating = false;
  // Times the floor moved to a new height after calibration.
  moves = 0;
  // The floor has looked wrong for a while as the user walked: worth calibrating again.
  doubtful = false;

  private hits: number[] = [];
  private pool: number[] = [];
  private calibrationDone = false;
  private calibrationStart = 0;
  private walked = 0;
  private lastCamera: Vec3 | null = null;
  private recent: number[] = [];
  private lastReestimate = 0;
  private reportedUnavailable = false;
  // How high the phone rides above the floor, from calibration. Walking keeps it about the same.
  private cameraYs: number[] = [];
  private aboveFloor: number | null = null;
  private moveVotes = 0;
  private offSince: number | null = null;
  private offFrom: Vec3 | null = null;
  private fineSince: number | null = null;

  constructor(guessY: number) {
    this.y = guessY;
  }

  get calibrated(): boolean {
    return this.source === "calibrated";
  }

  // A hit on a flat surface. The median of the first few hits sets the floor, unless calibration found it from depth.
  addHit(hitY: number, cameraY: number): void {
    if (this.calibrated || this.hits.length >= SENSING.floorHitSamples) return;
    const below = cameraY - hitY;
    if (below < SENSING.floorHitBelowCameraM.min || below > SENSING.floorHitBelowCameraM.max) return;
    this.hits.push(hitY);
    if (this.hits.length === SENSING.floorHitSamples) {
      this.y = median(this.hits);
      this.source = "hit_test";
    }
  }

  // Call once per update while tracking. Calibration starts on the first call.
  update(t: number, points: Float32Array, camera: Vec3, forward: Flat, right: Flat): FloorEvent | null {
    const candidates = floorCandidates(points, camera, forward, right);

    let event: FloorEvent | null = null;
    if (!this.calibrationDone && !this.calibrating) {
      this.calibrating = true;
      this.calibrationStart = t;
      this.walked = 0;
      this.lastCamera = null;
      event = "calibration_started";
    }

    if (this.calibrating) {
      if (this.lastCamera) this.walked += Math.hypot(camera.x - this.lastCamera.x, camera.z - this.lastCamera.z);
      this.lastCamera = { ...camera };
      this.cameraYs.push(camera.y);
      for (const y of candidates) this.pool.push(y);

      const timedOut = t - this.calibrationStart >= SENSING.calibrationMaxMs;
      const enough = this.pool.length >= SENSING.calibrationMinPoints;
      // A timeout is not calibration. Keep collecting until the full sample requirement is met.
      if (timedOut && !enough) {
        if (!this.reportedUnavailable) {
          this.reportedUnavailable = true;
          return "calibration_unavailable";
        }
        return event;
      }
      const finished = enough && (timedOut || this.walked >= SENSING.calibrationMoveM);
      if (!finished) return event;

      // Median of the lowest 20%: objects standing on the floor only add points above it.
      const sorted = this.pool.sort((a, b) => a - b);
      const lowest = sorted.slice(0, Math.max(1, Math.floor(sorted.length * SENSING.floorCalibrationLowestShare)));
      this.y = median(lowest);
      this.aboveFloor = median(this.cameraYs) - this.y;
      this.source = "calibrated";
      this.calibrating = false;
      this.calibrationDone = true;
      this.pool = [];
      this.cameraYs = [];
      this.lastReestimate = t;
      return "calibrated";
    }

    if (this.moved(t, candidates, camera)) return null;
    this.checkDoubt(t, candidates, camera);

    for (const y of candidates) {
      if (Math.abs(y - this.y) <= SENSING.floorReestimateBandM) this.recent.push(y);
    }
    if (t - this.lastReestimate >= SENSING.floorReestimateMs) {
      if (this.recent.length >= SENSING.floorReestimateMinPoints) {
        this.y += SENSING.floorReestimateWeight * (median(this.recent) - this.y);
        // A strap that slips changes the phone's height too.
        if (this.aboveFloor !== null) {
          this.aboveFloor += SENSING.floorReestimateWeight * (camera.y - this.y - this.aboveFloor);
        }
      }
      this.recent = [];
      this.lastReestimate = t;
    }
    return null;
  }

  // Starts calibration again on the next update, when the user asks. The old floor stays until it finishes.
  recalibrate(): void {
    this.calibrationDone = false;
    this.calibrating = false;
    this.pool = [];
    this.cameraYs = [];
    this.reportedUnavailable = false;
    this.clearDoubt();
  }

  // Most floor points sit away from the floor height, update after update, while the user walks on.
  // Moving the floor can't fix that when the calibration itself was off (taken on a step, say), so
  // it becomes a suggestion for the user.
  private checkDoubt(t: number, candidates: number[], camera: Vec3): void {
    if (candidates.length < SENSING.floorMoveMinPoints) return;
    const here = candidates.filter((y) => Math.abs(y - this.y) <= SENSING.floorReestimateBandM).length;
    if (here * 4 < candidates.length) {
      this.fineSince = null;
      if (this.offSince === null || this.offFrom === null) {
        this.offSince = t;
        this.offFrom = { ...camera };
      }
      const walked = Math.hypot(camera.x - this.offFrom.x, camera.z - this.offFrom.z);
      if (t - this.offSince >= SENSING.floorDoubtAfterMs && walked >= SENSING.floorDoubtWalkM) this.doubtful = true;
      return;
    }
    this.offSince = null;
    this.offFrom = null;
    if (!this.doubtful) return;
    this.fineSince ??= t;
    if (t - this.fineSince >= SENSING.floorDoubtClearMs) this.clearDoubt();
  }

  private clearDoubt(): void {
    this.doubtful = false;
    this.offSince = null;
    this.offFrom = null;
    this.fineSince = null;
  }

  // Depth shows a floor where the phone's height says it should be, and hardly any at the tracked
  // height, for a few updates in a row: the floor moves there at once. A phone held up higher,
  // or a platform ahead, shows no floor at that height, so neither moves it.
  private moved(t: number, candidates: number[], camera: Vec3): boolean {
    if (this.aboveFloor === null) return false;
    const band = SENSING.floorReestimateBandM;
    const expected = camera.y - this.aboveFloor;
    const there = Math.abs(expected - this.y) > band ? candidates.filter((y) => Math.abs(y - expected) <= band) : [];
    const here = candidates.filter((y) => Math.abs(y - this.y) <= band).length;
    if (there.length < SENSING.floorMoveMinPoints || here * 4 > there.length) {
      this.moveVotes = 0;
      return false;
    }
    if (++this.moveVotes < SENSING.floorMoveAfterUpdates) return false;
    this.y = median(there);
    this.moves++;
    this.moveVotes = 0;
    this.clearDoubt();
    this.recent = [];
    this.lastReestimate = t;
    return true;
  }
}
