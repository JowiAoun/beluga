// Records a replay clip during a walk: every sensing update and every new set of detector boxes,
// for 30 s, then stops by itself.

import type { Detection } from "@/lib/detect/detections";
import type { SensingUpdate } from "@/lib/xr/types";
import { REPLAY_VERSION, type ReplayClip } from "./format";

export const CLIP_SECONDS = 30;

export class Recorder {
  private updates: SensingUpdate[] = [];
  private detections: ReplayClip["detections"] = [];
  private lastDetections: Detection[] | null = null;
  private startedAt: number | null = null;
  done = false;

  // Returns true while it still wants updates.
  add(update: SensingUpdate, detections: Detection[]): boolean {
    this.startedAt ??= update.t;
    if (this.done || update.t - this.startedAt > CLIP_SECONDS * 1000) {
      this.done = true;
      return false;
    }
    this.updates.push(update);
    // The detector hands out a new array per frame, so a new reference is a new result.
    if (detections !== this.lastDetections) {
      this.lastDetections = detections;
      this.detections.push({ t: update.t, detections });
    }
    return true;
  }

  seconds(): number {
    const first = this.updates[0]?.t;
    const last = this.updates.at(-1)?.t;
    return first === undefined || last === undefined ? 0 : (last - first) / 1000;
  }

  clip(): ReplayClip {
    return {
      version: REPLAY_VERSION,
      recordedAt: new Date().toISOString(),
      updates: this.updates,
      detections: this.detections,
    };
  }
}
