// Puts the detector's files in `public` before `dev` and `build`: the MediaPipe WASM from
// node_modules, and the EfficientDet-Lite0 model from Google's model store. They are too big to
// commit (about 46 MB together), and the app must serve them itself so the detector works offline.
// A failure only warns: without the files the detector stays off and warnings still run on depth.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const WASM_FROM = "node_modules/@mediapipe/tasks-vision/wasm";
const WASM_TO = "public/mediapipe/wasm";
// The ES module build for the detector's worker, then the classic SIMD build and its fallback
// for phones without SIMD, used when the detector runs on the page instead.
const WASM_FILES = [
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const MODEL_TO = "public/models/efficientdet_lite0.tflite";
const MODEL_SHA256 = "4b59100025bea1235a84c1038879a6cccc9f6c49f5e41144e91e74d99e780993";

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function copyWasm(): void {
  mkdirSync(WASM_TO, { recursive: true });
  for (const file of WASM_FILES) {
    const from = path.join(WASM_FROM, file);
    const to = path.join(WASM_TO, file);
    if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
    copyFileSync(from, to);
  }
}

async function fetchModel(): Promise<void> {
  if (existsSync(MODEL_TO) && sha256(MODEL_TO) === MODEL_SHA256) return;
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`model download: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(data).digest("hex");
  if (hash !== MODEL_SHA256) throw new Error(`model checksum ${hash} is not the pinned one`);
  mkdirSync(path.dirname(MODEL_TO), { recursive: true });
  writeFileSync(MODEL_TO, data);
  console.info(`detector model saved to ${MODEL_TO}`);
}

async function main(): Promise<void> {
  try {
    copyWasm();
  } catch (err) {
    console.warn(`[detector assets] WASM copy failed, the detector will stay off: ${String(err)}`);
  }
  try {
    await fetchModel();
  } catch (err) {
    console.warn(`[detector assets] model download failed, the detector will stay off: ${String(err)}`);
  }
}

void main();
