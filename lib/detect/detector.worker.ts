// Runs the detector off the page's main thread, so a slow frame never holds up the safety loop.
// Turbopack starts it as a classic worker, where MediaPipe loads its classic build with
// importScripts. The ES module build is the second try, for a bundler that starts a module worker.

import { Detector } from "./detector";
import type { WorkerReply, WorkerRequest } from "./messages";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(reply: WorkerReply): void;
};

let detector: Detector | null = null;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type === "load") {
    Detector.create(false, request.prefer)
      .catch(() => Detector.create(true, request.prefer))
      .then(
        (loaded) => {
          detector = loaded;
          scope.postMessage({ type: "ready", delegate: loaded.delegate });
        },
        (err: unknown) => scope.postMessage({ type: "failed", error: errorText(err) }),
      );
    return;
  }
  if (!detector) return;
  const began = performance.now();
  try {
    const detections = detector.detect(request.image, request.hfovDeg);
    scope.postMessage({ type: "detections", t: request.t, detections, ms: performance.now() - began });
  } catch (err) {
    detector = null;
    scope.postMessage({ type: "failed", error: errorText(err) });
  }
};
