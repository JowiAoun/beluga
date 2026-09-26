import type { SmallImage } from "@/lib/xr/cameraImage";
import type { Detection } from "./detections";
import type { Delegate } from "./detector";

// Messages between the walk page and the detector's worker.
export type WorkerRequest =
  { type: "load"; prefer: Delegate } | { type: "detect"; image: SmallImage; hfovDeg: number; t: number };

export type WorkerReply =
  | { type: "ready"; delegate: Delegate }
  | { type: "failed"; error: string }
  // `t` is the session time of the frame the detections came from.
  | { type: "detections"; t: number; detections: Detection[]; ms: number };
