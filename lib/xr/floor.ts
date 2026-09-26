import { SENSING } from "@/lib/shared/params";
import type { Flat, FloorSource, Vec3 } from "./types";

export type FloorEvent = "calibration_started" | "calibrated";

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
// calibrates from depth while the user takes three slow steps, then follows slow drift.
export class FloorTracker {
  y: number;
  source: FloorSource = "guess";
  calibrating = false;

  private hits: number[] = [];
  private pool: number[] = [];
  private calibrationDone = false;
  private calibrationStart = 0;
  private walked = 0;
  private lastCamera: Vec3 | null = null;
  private recent: number[] = [];
  private lastReestimate = 0;

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
      for (const y of candidates) this.pool.push(y);

      const timedOut = t - this.calibrationStart >= SENSING.calibrationMaxMs;
      const enough = this.pool.length >= SENSING.calibrationMinPoints;
      const finished = timedOut || (enough && this.walked >= SENSING.calibrationMoveM);
      if (!finished) return event;

      // Out of time with too few points means the floor barely shows 0.5 to 2 m ahead (a phone
      // held level). Then use what there is, or keep the hit test's value, and follow drift from there.
      if (enough || this.pool.length >= SENSING.floorReestimateMinPoints) {
        // Median of the lowest 20%: objects standing on the floor only add points above it.
        const sorted = this.pool.sort((a, b) => a - b);
        const lowest = sorted.slice(0, Math.max(1, Math.floor(sorted.length * SENSING.floorCalibrationLowestShare)));
        this.y = median(lowest);
        this.source = "calibrated";
      }
      this.calibrating = false;
      this.calibrationDone = true;
      this.pool = [];
      this.lastReestimate = t;
      return "calibrated";
    }

    for (const y of candidates) {
      if (Math.abs(y - this.y) <= SENSING.floorReestimateBandM) this.recent.push(y);
    }
    if (t - this.lastReestimate >= SENSING.floorReestimateMs) {
      if (this.recent.length >= SENSING.floorReestimateMinPoints) {
        this.y += SENSING.floorReestimateWeight * (median(this.recent) - this.y);
      }
      this.recent = [];
      this.lastReestimate = t;
    }
    return null;
  }
}
