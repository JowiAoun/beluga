// Replay clips (Phase 10): 30 s of what the safety loop saw, so the hazard engine and the sounds
// can run again without an AR session: for regression tests, and as the demo's backup on any phone.
// A clip holds depth points, pose, floor, walking direction and detector boxes. No camera frames,
// so no bystander ends up in a clip. Gzipped JSON; points are millimetre offsets from the camera.

import type { Detection } from "@/lib/detect/detections";
import type { SensingUpdate } from "@/lib/xr/types";

export const REPLAY_VERSION = 1;

interface StoredUpdate extends Omit<SensingUpdate, "points" | "worldFromView" | "viewFromWorld" | "projection"> {
  worldFromView: number[];
  viewFromWorld: number[];
  projection: number[];
  // Base64 of an Int16Array: x, y, z in millimetres from the camera.
  points: string;
}

export interface ReplayClip {
  version: number;
  recordedAt: string;
  updates: SensingUpdate[];
  // Detector results with the session time they arrived.
  detections: Array<{ t: number; detections: Detection[] }>;
}

interface StoredClip {
  version: number;
  recordedAt: string;
  updates: StoredUpdate[];
  detections: Array<{ t: number; detections: Detection[] }>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Points within ±32 m of the camera fit in 16 bits at millimetre steps; depth stops at 5 m.
function packPoints(points: Float32Array, camera: SensingUpdate["camera"]): string {
  const packed = new Int16Array(points.length);
  const origin = [camera.x, camera.y, camera.z];
  for (let i = 0; i < points.length; i++) {
    packed[i] = Math.max(-32767, Math.min(32767, Math.round((points[i] - origin[i % 3]) * 1000)));
  }
  return toBase64(new Uint8Array(packed.buffer));
}

function unpackPoints(text: string, camera: SensingUpdate["camera"]): Float32Array {
  const bytes = fromBase64(text);
  const packed = new Int16Array(bytes.buffer, 0, bytes.length / 2);
  const origin = [camera.x, camera.y, camera.z];
  const points = new Float32Array(packed.length);
  for (let i = 0; i < packed.length; i++) points[i] = packed[i] / 1000 + origin[i % 3];
  return points;
}

async function gzip(text: string): Promise<Blob> {
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

export async function encodeClip(clip: ReplayClip): Promise<Blob> {
  const stored: StoredClip = {
    version: clip.version,
    recordedAt: clip.recordedAt,
    detections: clip.detections,
    updates: clip.updates.map((u) => ({
      ...u,
      worldFromView: Array.from(u.worldFromView),
      viewFromWorld: Array.from(u.viewFromWorld),
      projection: Array.from(u.projection),
      points: packPoints(u.points, u.camera),
    })),
  };
  return gzip(JSON.stringify(stored));
}

// Takes the gzipped file as fetched or picked. Plain JSON works too.
export async function decodeClip(data: Blob): Promise<ReplayClip> {
  const head = new Uint8Array(await data.slice(0, 2).arrayBuffer());
  const gzipped = head[0] === 0x1f && head[1] === 0x8b;
  const text = gzipped
    ? await new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).text()
    : await data.text();
  const stored = JSON.parse(text) as StoredClip;
  if (stored.version !== REPLAY_VERSION) throw new Error(`replay version ${stored.version} isn't supported`);
  return {
    version: stored.version,
    recordedAt: stored.recordedAt,
    detections: stored.detections,
    updates: stored.updates.map((u) => ({
      ...u,
      worldFromView: Float32Array.from(u.worldFromView),
      viewFromWorld: Float32Array.from(u.viewFromWorld),
      projection: Float32Array.from(u.projection),
      points: unpackPoints(u.points, u.camera),
    })),
  };
}
