import { SENSING } from "@/lib/shared/params";
import type { Flat, Vec3 } from "./types";

export interface MotionState {
  forward: Flat;
  right: Flat;
  speed: number;
  stationary: boolean;
}

interface Sample {
  t: number;
  x: number;
  z: number;
}

function normalize(x: number, z: number): Flat | null {
  const length = Math.hypot(x, z);
  return length > 1e-6 ? { x: x / length, z: z / length } : null;
}

// Walking direction, speed and the stationary flag, from the camera pose.
export class MotionTracker {
  private facing: Flat | null = null;
  private lastT: number | null = null;
  private history: Sample[] = [];

  // Positions jump when tracking comes back, so the history starts over. The direction is kept.
  reset(): void {
    this.history = [];
    this.lastT = null;
  }

  update(t: number, camera: Vec3, cameraForward: Vec3): MotionState {
    const flatLength = Math.hypot(cameraForward.x, cameraForward.z);
    if (flatLength >= SENSING.forwardMinFlat) {
      const flat = { x: cameraForward.x / flatLength, z: cameraForward.z / flatLength };
      if (!this.facing || this.lastT === null) {
        this.facing = flat;
      } else {
        const a = 1 - Math.exp(-(t - this.lastT) / SENSING.walkingDirectionSmoothingMs);
        this.facing =
          normalize(this.facing.x + a * (flat.x - this.facing.x), this.facing.z + a * (flat.z - this.facing.z)) ?? flat;
      }
    }
    this.lastT = t;
    const facing = this.facing ?? { x: 0, z: -1 };

    this.history.push({ t, x: camera.x, z: camera.z });
    const window = Math.max(SENSING.stationaryWindowMs, SENSING.travelDirectionWindowMs);
    // Keep one sample at or before the start of the longest window.
    while (this.history.length > 1 && this.history[1].t <= t - window) this.history.shift();

    let speed = 0;
    let forward = facing;
    const from = this.lastAtOrBefore(t - SENSING.travelDirectionWindowMs);
    if (from) {
      const dx = camera.x - from.x;
      const dz = camera.z - from.z;
      speed = (Math.hypot(dx, dz) * 1000) / (t - from.t);
      const travel = normalize(dx, dz);
      // A phone on a strap twists away from where the user is going, so blend in the travel
      // direction. Walking backwards is left out: opposite directions would cancel.
      if (travel && speed > SENSING.travelBlendMinSpeedMps && travel.x * facing.x + travel.z * facing.z > 0) {
        const w = SENSING.travelBlendWeight;
        forward = normalize((1 - w) * facing.x + w * travel.x, (1 - w) * facing.z + w * travel.z) ?? facing;
      }
    }

    let stationary = false;
    const windowStart = this.lastAtOrBefore(t - SENSING.stationaryWindowMs);
    if (windowStart) {
      stationary = this.history.every(
        (s) => s.t < windowStart.t || Math.hypot(s.x - camera.x, s.z - camera.z) < SENSING.stationaryMaxMoveM,
      );
    }

    return { forward, right: { x: -forward.z, z: forward.x }, speed, stationary };
  }

  private lastAtOrBefore(time: number): Sample | null {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].t <= time) return this.history[i];
    }
    return null;
  }
}
