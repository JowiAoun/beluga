import type { SensingUpdate } from "./types";

// A guessed or hit-tested floor is never sufficient for depth-mode detection.
// Camera-only mode requires a separate, explicit acknowledgement of its estimates.
export function detectionReady(
  update: Pick<SensingUpdate, "tracking" | "calibrating" | "floorSource"> | null,
  cameraOnly = false,
  estimatesConfirmed = false,
): boolean {
  if (!update?.tracking) return false;
  if (cameraOnly) return estimatesConfirmed;
  return !update.calibrating && update.floorSource === "calibrated";
}
