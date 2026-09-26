// The on-phone object detector: MediaPipe's EfficientDet-Lite0 (COCO classes), served by the app
// itself so it works offline (`scripts/detector-assets.ts` puts the files in `public`). It only
// names depth hazards, so the walk goes on without it if it fails to load.

import { FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import { DETECTOR } from "@/lib/shared/params";
import type { SmallImage } from "@/lib/xr/cameraImage";
import { toDetection, type Detection } from "./detections";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/models/efficientdet_lite0.tflite";

export type Delegate = "GPU" | "CPU";

// `useModule` loads the ES module build, the only one a module worker can load. A classic worker
// or the page itself loads the classic build.
async function createTask(delegate: Delegate, useModule: boolean): Promise<ObjectDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH, useModule);
  // GPU needs a canvas of its own for its WebGL context; the XR layer keeps the page's.
  const canvas = delegate === "GPU" ? new OffscreenCanvas(1, 1) : undefined;
  const task = await ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    canvas,
    runningMode: "VIDEO",
    scoreThreshold: DETECTOR.scoreThreshold,
    maxResults: DETECTOR.maxResults,
  });
  // A task can load and still fail on its first picture (Safari's engine without WebGL in a
  // worker). One blank picture now turns that into a failed load, so the next option gets its turn.
  try {
    task.detectForVideo(new ImageData(WARM_UP_PX, WARM_UP_PX), performance.now());
  } catch (err) {
    task.close();
    throw err;
  }
  return task;
}

const WARM_UP_PX = 32;

export class Detector {
  private constructor(
    private readonly task: ObjectDetector,
    readonly delegate: Delegate,
  ) {}

  // GPU first, then CPU, unless CPU is asked for. Throws when neither loads (no files, or no
  // network on a first visit).
  static async create(useModule = false, prefer: Delegate = "GPU"): Promise<Detector> {
    if (prefer === "GPU") {
      try {
        return new Detector(await createTask("GPU", useModule), "GPU");
      } catch {
        // CPU below.
      }
    }
    return new Detector(await createTask("CPU", useModule), "CPU");
  }

  // `hfovDeg` is the camera's horizontal field of view: the small frame is the whole view.
  detect(image: SmallImage, hfovDeg: number): Detection[] {
    const frame = new ImageData(image.data, image.width, image.height);
    // Video mode wants timestamps that only go up, across sessions too.
    const result = this.task.detectForVideo(frame, performance.now());
    const detections: Detection[] = [];
    for (const d of result.detections) {
      const category = d.categories[0];
      const box = d.boundingBox;
      if (!category || !box) continue;
      const raw = {
        name: category.categoryName,
        score: category.score,
        x: box.originX,
        y: box.originY,
        width: box.width,
        height: box.height,
      };
      const detection = toDetection(raw, image.width, image.height, hfovDeg);
      if (detection) detections.push(detection);
    }
    return detections;
  }

  close(): void {
    this.task.close();
  }
}
