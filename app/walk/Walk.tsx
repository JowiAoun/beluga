"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/engine";
import { decodeLibrary, fetchLibrary, type RawLibrary } from "@/lib/audio/library";
import { DetectPipeline } from "@/lib/detect/pipeline";
import { nearestAhead } from "@/lib/hazard/corridor";
import { HazardEngine, type HazardEvent } from "@/lib/hazard/engine";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { DEBUG_OVERLAY, SENSING } from "@/lib/shared/params";
import {
  errorText,
  startSensing,
  type Cue,
  type Granted,
  type SensingSession,
  type SessionSummary,
} from "@/lib/xr/session";
import type { SensingUpdate } from "@/lib/xr/types";
import DebugOverlay, { type DebugView } from "./DebugOverlay";
import { askLocation, locationPermission, watchLocation, type Fix } from "./location";
import StopButton from "./StopButton";
import { LINES, say, speakText, unlockVoice } from "./voice";

type Phase = "ready" | "starting" | "running" | "ended";
type Support = "checking" | "ok" | "none";

const DEBUG_KEY = "beluga.debug";

function readDebugDefault(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDebugDefault(on: boolean): void {
  try {
    localStorage.setItem(DEBUG_KEY, on ? "1" : "0");
  } catch {
    // Private mode: the switch still works for this visit.
  }
}

async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    return "wakeLock" in navigator ? await navigator.wakeLock.request("screen") : null;
  } catch {
    return null;
  }
}

interface Latest {
  update: SensingUpdate | null;
  nearest: number | null;
  fix: Fix | null;
  granted: Granted | null;
  hazards: HazardUpdate[];
  // Newest first. Phase 9 queues these for sending; until then the overlay shows them.
  events: HazardEvent[];
  floorSlope: number | null;
}

const RECENT_EVENTS = 5;

function freshLatest(fix: Fix | null = null): Latest {
  return { update: null, nearest: null, fix, granted: null, hazards: [], events: [], floorSlope: null };
}

export default function Walk() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const sessionRef = useRef<SensingSession | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef<AudioEngine | null>(null);
  const libraryRef = useRef<RawLibrary | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const debugRef = useRef(false);
  const latestRef = useRef<Latest>(freshLatest());
  const engineRef = useRef<HazardEngine | null>(null);
  const detectRef = useRef<DetectPipeline | null>(null);

  const [support, setSupport] = useState<Support>("checking");
  const [needLocation, setNeedLocation] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [session, setSession] = useState<SensingSession | null>(null);
  const [debug, setDebug] = useState(false);
  const [view, setView] = useState<DebugView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const runCleanups = useCallback(() => {
    cleanupRef.current.splice(0).forEach((fn) => fn());
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    // Taps on the overlay must not also fire an XR select.
    const stopSelect = (e: Event) => e.preventDefault();
    overlay?.addEventListener("beforexrselect", stopSelect);

    const check = async () => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { xrCompatible: true, alpha: true, antialias: false });
      glRef.current = gl;
      let supported = false;
      try {
        supported = Boolean(gl && navigator.xr && (await navigator.xr.isSessionSupported("immersive-ar")));
      } catch {
        supported = false;
      }
      setSupport(supported ? "ok" : "none");
      const permission = await locationPermission();
      setNeedLocation(permission === "prompt");
      setLocationGranted(permission === "granted");
      const on = readDebugDefault();
      debugRef.current = on;
      setDebug(on);
    };
    void check();
    // The recorded sounds download now, so the walk itself needs no network.
    void fetchLibrary().then((raw) => {
      libraryRef.current = raw;
    });
    // The detector model loads now too, ready for the first walk. `?detector=cpu` keeps it off
    // the GPU and `?detector=off` turns it off, to compare update rates on the phone.
    const detect = (detectRef.current ??= new DetectPipeline());
    const choice = new URLSearchParams(window.location.search).get("detector");
    if (choice === "off") detect.disable();
    else void detect.load(choice === "cpu" ? "CPU" : "GPU");

    return () => {
      overlay?.removeEventListener("beforexrselect", stopSelect);
      sessionRef.current?.stop();
      runCleanups();
    };
  }, [runCleanups]);

  // Numbers for the overlay refresh a few times a second, not on every update.
  useEffect(() => {
    if (phase !== "starting" && phase !== "running") return;
    const id = window.setInterval(() => {
      setView({
        ...latestRef.current,
        stats: sessionRef.current?.stats() ?? null,
        audio: soundRef.current?.stats() ?? null,
        detect: detectRef.current?.stats() ?? null,
      });
    }, DEBUG_OVERLAY.refreshMs);
    return () => window.clearInterval(id);
  }, [phase]);

  const onUpdate = useCallback((update: SensingUpdate) => {
    const latest = latestRef.current;
    latest.update = update;
    // Out to the full depth range, so the tape-measure check works past the corridor's 3 m.
    latest.nearest = update.tracking ? nearestAhead(update, SENSING.depthMaxM) : null;
    const detect = detectRef.current;
    const result = engineRef.current?.update(update, detect?.labelFor(update));
    if (!result) return;
    detect?.check(update, result.hazards, latest.fix);
    // While tracking is lost the list is empty, so every warning goes quiet.
    soundRef.current?.update(result.hazards, update);
    latest.hazards = result.hazards;
    if (result.floor) latest.floorSlope = result.floor.slope;
    if (result.events.length > 0) latest.events = [...result.events.reverse(), ...latest.events].slice(0, RECENT_EVENTS);
  }, []);

  const onCue = useCallback((cue: Cue) => say(cue), []);

  const onEnd = useCallback(
    (result: SessionSummary) => {
      sessionRef.current = null;
      setSession(null);
      runCleanups();
      // A session that never got going is reported by the start handler instead.
      if (!result.granted) return;
      setPhase("ended");
      setSummary(result);
      say("stopped");
      if (debugRef.current) {
        console.info("[beluga walk] summary", result);
        // Chrome's Bluetooth latency estimate, next to the Phase 3 target of 0.6 s to the first sound.
        const ctx = audioRef.current;
        const outputLatencyMs = ctx ? Math.round(((ctx.outputLatency || 0) + ctx.baseLatency) * 1000) : null;
        // Lands in the dev server terminal (or Vercel logs) for testers. No location in it.
        void fetch("/api/device-check", {
          method: "POST",
          body: JSON.stringify({ kind: "walk", ...result, outputLatencyMs }),
        }).catch(() => {});
      }
    },
    [runCleanups],
  );

  const start = () => {
    const overlay = overlayRef.current;
    const gl = glRef.current;
    if (!overlay || !gl || support !== "ok") return;

    // startSensing calls requestSession before anything else in this tap.
    const started = startSensing({ overlayRoot: overlay, gl, onUpdate, onCue, onEnd });
    sessionRef.current = started;

    // The same tap has to resume audio and unlock speech, or Chrome keeps both silent.
    const ctx = (audioRef.current ??= new AudioContext({ latencyHint: "interactive" }));
    void ctx.resume();
    unlockVoice();
    const sound = new AudioEngine(ctx, { speak: speakText });
    sound.start();
    soundRef.current = sound;
    // Tones play until the library is decoded, a moment later.
    const raw = libraryRef.current;
    if (raw) void decodeLibrary(ctx, raw).then((library) => sound.useLibrary(library));
    cleanupRef.current.push(() => {
      sound.stop();
      if (soundRef.current === sound) soundRef.current = null;
    });
    void requestWakeLock().then((lock) => {
      if (!lock) return;
      if (sessionRef.current === started) cleanupRef.current.push(() => void lock.release());
      else void lock.release();
    });
    // Only with permission already given: a prompt inside AR may never show.
    if (locationGranted) {
      cleanupRef.current.push(
        watchLocation((fix) => {
          latestRef.current.fix = fix;
        }),
      );
    }

    latestRef.current = freshLatest(latestRef.current.fix);
    engineRef.current = new HazardEngine();
    const detect = detectRef.current;
    if (detect) cleanupRef.current.push(detect.attach(started));
    setSession(started);
    setMessage(null);
    setSummary(null);
    setView(null);
    setPhase("starting");

    started.ready.then(
      (granted) => {
        latestRef.current.granted = granted;
        setPhase((p) => (p === "starting" ? "running" : p));
        if (!granted.depth) {
          say("no_depth");
          setMessage(LINES.no_depth);
        }
      },
      (err: unknown) => {
        if (sessionRef.current === started) sessionRef.current = null;
        setSession(null);
        runCleanups();
        setPhase("ready");
        say("start_failed");
        setMessage(`beluga could not start: ${errorText(err)}`);
      },
    );
  };

  const toggleDebug = () => {
    const next = !debug;
    debugRef.current = next;
    setDebug(next);
    saveDebugDefault(next);
  };

  const allowLocation = async () => {
    await askLocation();
    const permission = await locationPermission();
    setNeedLocation(permission === "prompt");
    setLocationGranted(permission === "granted");
  };

  const inAr = phase === "starting" || phase === "running";
  const update = view?.update ?? null;
  let status: string | null = null;
  if (phase === "starting") status = "Starting";
  else if (update && !update.tracking) status = "Hold steady";
  else if (update?.calibrating) status = "Calibrating — take three slow steps";
  else if (update?.floorSource === "calibrated") status = "Calibrated";
  else if (update && view?.granted?.depth) status = "Floor estimated — calibration unavailable";

  return (
    <div
      ref={overlayRef}
      onTouchStart={(e) => {
        // Three fingers toggle the debug overlay. TalkBack keeps multi-finger gestures, so this is for sighted testers.
        if (inAr && e.touches.length === 3) toggleDebug();
      }}
      className={`min-h-dvh w-full ${inAr ? "bg-transparent" : "bg-background"} text-foreground`}
    >
      {inAr ? (
        <main className="flex min-h-dvh flex-col justify-between gap-3 p-3">
          <div className="flex flex-col gap-2">
            {status && (
              <p
                role="status"
                aria-atomic="true"
                className={`self-start rounded-lg border-2 px-4 py-3 text-2xl font-bold ${
                  status === "Calibrated"
                    ? "border-emerald-300 bg-emerald-950 text-white"
                    : "border-white bg-black text-white"
                }`}
              >
                {status}
              </p>
            )}
            {message && (
              <p role="alert" className="rounded bg-red-900/90 px-3 py-2 text-white">
                {message}
              </p>
            )}
            {debug && <DebugOverlay view={view} session={session} />}
          </div>
          <StopButton onStop={() => sessionRef.current?.stop()} />
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold">beluga</h1>
            <p className="text-lg">
              Plays a sound from the side of obstacles in your path. It works alongside your cane or guide dog, and it can
              miss things.
            </p>
          </header>

          {support === "none" && (
            <p role="alert" className="rounded-lg bg-red-900 p-3">
              This browser can&apos;t start an AR session. Use Chrome on an Android phone with ARCore, and run the device
              check below to see what is missing.
            </p>
          )}

          {needLocation && (
            <div className="flex flex-col gap-2">
              <p>
                Location marks where hazard reports happen, to about 100 m. Chrome can&apos;t ask during a session, so it
                asks now.
              </p>
              <button
                type="button"
                onClick={allowLocation}
                className="min-h-16 rounded-lg border-2 border-yellow-300 px-4 text-lg font-semibold"
              >
                Allow location
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={start}
            disabled={support !== "ok"}
            className="min-h-24 rounded-lg bg-yellow-300 px-4 text-2xl font-bold text-black disabled:opacity-50"
          >
            {support === "checking" ? "Checking this phone" : phase === "ended" ? "Start again" : "Start"}
          </button>

          {message && (
            <p role="alert" className="rounded-lg bg-red-900 p-3">
              {message}
            </p>
          )}

          {summary && debug && <Summary summary={summary} />}

          <label className="flex min-h-16 items-center gap-3 text-lg">
            <input type="checkbox" checked={debug} onChange={toggleDebug} className="h-6 w-6" />
            Show the debug overlay (a three-finger tap also toggles it during a session)
          </label>
          <Link href="/walk/check" className="text-lg underline">
            Device check
          </Link>
          <Link href="/walk/sounds" className="text-lg underline">
            Sound check and blindfold test
          </Link>
        </main>
      )}
    </div>
  );
}

function metres(value: number | null): string {
  return value === null ? "not measured" : `${value.toFixed(2)} m`;
}

// The last session's numbers against the Phase 1 targets.
function Summary({ summary }: { summary: SessionSummary }) {
  const { floor } = summary;
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-neutral-600 p-3 tabular-nums">
      <h2 className="text-lg font-semibold">Last session</h2>
      <p>
        {Math.round(summary.durationS)} s, ended by {summary.reason}
        {summary.error && `: ${summary.error}`}
      </p>
      <p>
        {summary.updateRate.toFixed(1)} updates/s (target about 10), {summary.frameRate.toFixed(0)} frames/s
      </p>
      <p>Tracking lost {Math.round(summary.trackingLostShare * 100)}% of the time</p>
      <p>
        Depth valid{" "}
        {summary.depthValidShare === null ? "never" : `${Math.round(summary.depthValidShare * 100)}% of points`}
      </p>
      <p>
        Floor {floor.source.replace("_", " ")}
        {floor.calibratedAfterS !== null && ` after ${floor.calibratedAfterS.toFixed(1)} s`}, moved{" "}
        {metres(floor.driftM)} since (target 0.20 m or less)
      </p>
      <p>Phone {metres(floor.phoneAboveFloorM)} above the floor on average</p>
    </section>
  );
}
