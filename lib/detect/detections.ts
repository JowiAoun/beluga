// What the detector reports, in beluga's terms: a class from the shared enum, a box in frame
// fractions and an angle. Pure, so tests and the overlay use it without MediaPipe.

import type { SmallImage } from "@/lib/xr/cameraImage";
import { DETECTOR_CLASSES, type DetectorClass } from "@/lib/shared/enums";

// Fractions of the frame, 0 to 1, from the top-left corner.
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Detection {
  label: DetectorClass;
  score: number;
  box: Box;
  // Degrees from the centre of the camera view, negative to the left.
  angle: number;
}

// The COCO classes beluga has a sound for. `pole_like` and `unknown` come from depth, never the model.
const NAMED: ReadonlySet<string> = new Set(DETECTOR_CLASSES.filter((c) => c !== "pole_like" && c !== "unknown"));

// MediaPipe names have spaces ("fire hydrant"); the enum has underscores.
export function toDetectorClass(name: string): DetectorClass {
  const key = name.trim().toLowerCase().replace(/ /g, "_");
  return NAMED.has(key) ? (key as DetectorClass) : "unknown";
}

export function centreOf(box: Box): number {
  return (box.left + box.right) / 2;
}

// As the plan has it: (box centre − 0.5) × the camera's horizontal field of view.
export function angleOfBox(box: Box, hfovDeg: number): number {
  return (centreOf(box) - 0.5) * hfovDeg;
}

export interface RawDetection {
  name: string;
  score: number;
  // Pixels in the frame the detector saw.
  x: number;
  y: number;
  width: number;
  height: number;
}

// Null for classes beluga has no use for: they would only hide a depth hazard's pole-like label.
export function toDetection(
  raw: RawDetection,
  frameWidth: number,
  frameHeight: number,
  hfovDeg: number,
): Detection | null {
  const label = toDetectorClass(raw.name);
  if (label === "unknown") return null;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const box = {
    left: clamp(raw.x / frameWidth),
    top: clamp(raw.y / frameHeight),
    right: clamp((raw.x + raw.width) / frameWidth),
    bottom: clamp((raw.y + raw.height) / frameHeight),
  };
  return { label, score: raw.score, box, angle: angleOfBox(box, hfovDeg) };
}

// Mean brightness, 0 to 255, from every 4th pixel. The frame gate skips dark frames.
export function meanBrightness(image: SmallImage): number {
  const { data } = image;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  return count === 0 ? 0 : sum / count;
}
