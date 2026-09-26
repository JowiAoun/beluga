"use client";

// Replay mode (Phase 10): /walk?replay=<file> runs a recorded clip through the real hazard engine
// and sounds, at real time, with no AR session. The demo's backup on any phone or laptop, and a
// way to hear a change to the engine on the same walk twice.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/engine";
import { LabelMatcher } from "@/lib/detect/match";
import { CameraOnlyEngine } from "@/lib/hazard/cameraOnly";
import { nearestAhead } from "@/lib/hazard/corridor";
import { HazardEngine, type HazardEvent } from "@/lib/hazard/engine";
import type { Detection } from "@/lib/detect/detections";
import { decodeClip, type ReplayClip } from "@/lib/replay/format";
import { SENSING } from "@/lib/shared/params";
import DebugOverlay, { type DebugView } from "./DebugOverlay";
import { readSettings } from "./settings";
import { speakText } from "./voice";

const RECENT_EVENTS = 5;

export default function ReplayPlayer({ src }: { src: string }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [clip, setClip] = useState<ReplayClip | null>(null);
  const [status, setStatus] = useState(src ? "Loading the clip" : "Pick a clip to play");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [view, setView] = useState<DebugView | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
      .then(decodeClip)
      .then(
        (loaded) => {
          if (cancelled) return;
          setClip(loaded);
          setStatus(describe(loaded));
        },
        (err: unknown) => !cancelled && setStatus(`Couldn't load ${src}: ${err instanceof Error ? err.message : err}`),
      );
    return () => {
      cancelled = true;
      stopRef.current?.();
    };
  }, [src]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const loaded = await decodeClip(file);
      setClip(loaded);
      setStatus(describe(loaded));
    } catch (err) {
      setStatus(`Couldn't read that file: ${err instanceof Error ? err.message : err}`);
    }
  };

  const play = () => {
    if (!clip || clip.updates.length === 0) return;
    stopRef.current?.();
    const ctx = (ctxRef.current ??= new AudioContext({ latencyHint: "interactive" }));
    void ctx.resume();
    const sound = new AudioEngine(ctx, { speak: speakText });
    const settings = readSettings();
    sound.start();
    sound.setVolume(settings.volumeDb);
    const engine = new HazardEngine(settings.heightM);
    const matcher = new LabelMatcher();
    // With camera-only mode on in the settings, the clip's boxes play without its depth.
    const cameraEngine = settings.cameraOnly ? new CameraOnlyEngine() : null;
    let boxes: Detection[] = [];
    let events: HazardEvent[] = [];
    let timer: number | null = null;
    let stopped = false;
    const first = clip.updates[0].t;
    const started = performance.now();

    const step = (i: number, loopStart: number) => {
      if (stopped) return;
      if (i >= clip.updates.length) {
        if (!loop) return stop();
        engine.reset();
        matcher.reset();
        cameraEngine?.reset();
        return step(0, performance.now());
      }
      const update = clip.updates[i];
      for (const d of clip.detections) {
        if (d.t <= update.t && d.t > (clip.updates[i - 1]?.t ?? -Infinity)) {
          matcher.update(d.detections, d.t);
          boxes = d.detections;
        }
      }
      const hfov = update.fov.horizontal;
      const result = cameraEngine
        ? cameraEngine.update(update, boxes)
        : engine.update(update, (q) => matcher.labelFor(q, update.t, hfov));
      sound.update(result.hazards, update);
      if (result.events.length > 0) events = [...result.events.reverse(), ...events].slice(0, RECENT_EVENTS);
      setView({
        update,
        nearest: update.tracking ? nearestAhead(update, SENSING.depthMaxM) : null,
        fix: null,
        granted: null,
        hazards: result.hazards,
        events,
        floorSlope: result.floor?.slope ?? null,
        stats: null,
        audio: sound.stats(),
        detect: null,
        lastAsk: null,
        reporting: null,
      });
      const next = clip.updates[i + 1];
      const due = next ? loopStart + (next.t - first) : performance.now();
      timer = window.setTimeout(() => step(i + 1, loopStart), Math.max(0, due - performance.now()));
    };

    const stop = () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      sound.stop();
      setPlaying(false);
      stopRef.current = null;
    };
    stopRef.current = stop;
    setPlaying(true);
    step(0, started);
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">beluga replay</h1>
        <p>
          A recorded walk played through the real warning sounds, with no camera or AR session. Recorded, not live.
        </p>
      </header>
      <p role="status" className="text-lg">
        {status}
      </p>
      <label className="flex flex-col gap-1 text-lg">
        Play a clip saved on this device
        <input type="file" accept=".gz,.json,application/gzip,application/json" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      <label className="flex min-h-12 items-center gap-3 text-lg">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="h-6 w-6" disabled={playing} />
        Start again at the end
      </label>
      {playing ? (
        <button type="button" onClick={() => stopRef.current?.()} className="min-h-20 rounded-lg bg-red-800 text-2xl font-bold">
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={play}
          disabled={!clip}
          className="min-h-20 rounded-lg bg-yellow-300 text-2xl font-bold text-black disabled:opacity-50"
        >
          Play
        </button>
      )}
      {view && <DebugOverlay view={view} session={null} />}
      <Link href="/walk" className="text-lg underline">
        Back to beluga
      </Link>
    </main>
  );
}

function describe(clip: ReplayClip): string {
  const seconds = (clip.updates.at(-1)!.t - clip.updates[0].t) / 1000;
  const when = new Date(clip.recordedAt).toLocaleString("en-CA", { timeZone: "America/Toronto" });
  return `Recorded ${when}: ${seconds.toFixed(0)} s, ${clip.updates.length} updates.`;
}
