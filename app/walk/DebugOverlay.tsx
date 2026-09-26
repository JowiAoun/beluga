"use client";

import { useEffect, useRef, useState } from "react";
import type { HazardEvent } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { AUDIO } from "@/lib/shared/params";
import { forwardOf } from "@/lib/xr/geometry";
import type { Granted, LiveStats, SensingSession } from "@/lib/xr/session";
import type { SensingUpdate } from "@/lib/xr/types";
import type { Fix } from "./location";

export interface DebugView {
  update: SensingUpdate | null;
  nearest: number | null;
  fix: Fix | null;
  granted: Granted | null;
  hazards: HazardUpdate[];
  events: HazardEvent[];
  floorSlope: number | null;
  stats: LiveStats | null;
}

function side(angle: number): string {
  if (Math.abs(angle) < AUDIO.centreZoneDeg) return "ahead";
  return `${Math.abs(angle).toFixed(0)}° ${angle < 0 ? "left" : "right"}`;
}

function describe(h: HazardUpdate): string {
  const label = h.label === "unknown" ? "" : ` (${h.label.replace("_", " ")})`;
  return `${h.kind.replace("_", " ")}${label} ${h.distance.toFixed(2)} m, ${side(h.angle)}, covers ${Math.round(h.blocking * 100)}%`;
}

const FEATURE_NAMES: Record<keyof Granted, string> = {
  depth: "depth",
  camera: "camera",
  hitTest: "hit test",
  domOverlay: "DOM overlay",
  localFloor: "local-floor",
};

// Degrees from the camera's forward to the walking direction, positive to the right.
// Non-zero while walking means the travel-direction blend is at work.
function corridorTurn(update: SensingUpdate): number {
  const camera = forwardOf(update.worldFromView);
  const { forward } = update;
  return (Math.atan2(camera.x * forward.z - camera.z * forward.x, camera.x * forward.x + camera.z * forward.z) * 180) / Math.PI;
}

// For sighted testers: the numbers behind the Phase 1 checks, readable at arm's length.
export default function DebugOverlay({ view, session }: { view: DebugView | null; session: SensingSession | null }) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [frameInfo, setFrameInfo] = useState<string | null>(null);

  // Shows the detector's small frames, which proves the camera path before the detector exists.
  useEffect(() => {
    if (!session) return;
    return session.onDetectorFrame((image) => {
      const canvas = previewRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    });
  }, [session]);

  const testFrame = async () => {
    if (!session) return;
    setFrameInfo("waiting for a frame");
    const began = performance.now();
    const frame = await session.captureFrame();
    const ms = Math.round(performance.now() - began);
    setFrameInfo(
      frame
        ? `${frame.width} × ${frame.height} JPEG, ${Math.round(frame.blob.size / 1024)} KB in ${ms} ms`
        : "no frame: camera access missing or no image in time",
    );
  };

  const update = view?.update ?? null;
  const stats = view?.stats ?? null;
  const missing = view?.granted
    ? (Object.keys(FEATURE_NAMES) as Array<keyof Granted>).filter((k) => !view.granted?.[k]).map((k) => FEATURE_NAMES[k])
    : [];

  let nearestText = "waiting";
  if (update && !update.tracking) nearestText = "tracking lost";
  else if (update && update.validCount === 0) nearestText = "no depth";
  else if (update) nearestText = view?.nearest == null ? "clear" : `${view.nearest.toFixed(2)} m`;

  const turn = update ? corridorTurn(update) : 0;

  return (
    <section aria-live="off" className="flex flex-col gap-1 rounded-lg bg-black/75 p-3 text-sm text-white tabular-nums">
      <p className="text-xs uppercase opacity-70">Nearest in corridor</p>
      <p className="text-5xl font-bold">{nearestText}</p>
      <ul className="flex flex-col text-base font-semibold">
        {(view?.hazards ?? []).map((h) => (
          <li key={h.id}>{describe(h)}</li>
        ))}
        {view && view.hazards.length === 0 && <li className="font-normal opacity-70">No hazards</li>}
      </ul>
      {view && view.events.length > 0 && (
        <p className="opacity-80">
          Last events: {view.events.map((e) => `${e.type.replace("_", " ")} ${e.hazard.kind.replace("_", " ")}`).join(", ")}
        </p>
      )}
      {stats && (
        <p>
          {stats.updateRate.toFixed(1)} updates/s, {stats.frameRate.toFixed(0)} frames/s, {stats.processingMs.toFixed(1)} ms per update
        </p>
      )}
      {update && (
        <>
          <p>
            Depth {update.validCount} of {update.sampleCount} points
            {stats?.depthError && `, error: ${stats.depthError}`}
          </p>
          <p>
            Phone {(update.camera.y - update.floorY).toFixed(2)} m above the floor ({update.floorSource.replace("_", " ")}
            {update.calibrating && ", calibrating"})
            {view?.floorSlope != null && `, slope ${(view.floorSlope * 100).toFixed(0)}%`}
          </p>
          <p>
            {update.speed.toFixed(2)} m/s, {update.stationary ? "stationary" : "moving"}, corridor {Math.abs(turn).toFixed(0)}°{" "}
            {turn >= 0 ? "right" : "left"} of the camera
          </p>
          <p>
            View {update.fov.horizontal.toFixed(0)}° wide × {update.fov.vertical.toFixed(0)}° tall
          </p>
        </>
      )}
      {stats?.cameraError && <p>Camera off after an error: {stats.cameraError}</p>}
      <p>
        Location {view?.fix ? `±${Math.round(view.fix.accuracy)} m` : "no fix"}
        {missing.length > 0 && `. Not granted: ${missing.join(", ")}`}
      </p>
      <div className="mt-1 flex items-start gap-3">
        <canvas ref={previewRef} aria-label="Detector frame" className="w-24 rounded border border-white/40" />
        <div className="flex flex-col gap-1">
          <button type="button" onClick={testFrame} className="min-h-12 rounded bg-neutral-700 px-3 font-semibold">
            Test Gemini frame
          </button>
          {frameInfo && <p>{frameInfo}</p>}
        </div>
      </div>
    </section>
  );
}
