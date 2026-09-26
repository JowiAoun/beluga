"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHECKS, initialResults, type CheckId, type CheckResults, type CheckStatus, type Report } from "./checks";
import {
  describeLatency,
  errorText,
  playSweep,
  requestWakeLock,
  startAudio,
  watchCompass,
  watchLocation,
} from "./sensors";
import { runXrCheck, sessionInit, type LiveStats } from "./xrCheck";

type Phase = "ready" | "running" | "done";

const STATUS_TEXT: Record<CheckStatus, string> = {
  idle: "not run",
  running: "running",
  pass: "pass",
  warn: "check",
  fail: "fail",
  info: "info",
};

const STATUS_CLASS: Record<CheckStatus, string> = {
  idle: "bg-neutral-700 text-neutral-200",
  running: "bg-sky-800 text-sky-50",
  pass: "bg-emerald-700 text-emerald-50",
  warn: "bg-amber-400 text-black",
  fail: "bg-red-700 text-red-50",
  info: "bg-neutral-600 text-neutral-50",
};

const SESSION_CHECKS = [
  "session",
  "domOverlay",
  "floor",
  "hitTest",
  "depth",
  "camera",
  "fov",
  "tracking",
  "audio",
  "wakeLock",
  "location",
  "compassInAr",
] as const;

function displayMode(): string {
  for (const mode of ["fullscreen", "standalone", "minimal-ui"]) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode;
  }
  return "browser";
}

export default function DeviceCheck() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const resultsRef = useRef<CheckResults>(initialResults());
  const liveRef = useRef<LiveStats | null>(null);

  const [results, setResults] = useState<CheckResults>(initialResults);
  const [live, setLive] = useState<LiveStats | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [inAr, setInAr] = useState(false);
  const [xrReady, setXrReady] = useState(false);
  const [askLocation, setAskLocation] = useState(false);
  const [audioQuestion, setAudioQuestion] = useState(false);
  const [copied, setCopied] = useState(false);

  // The ref holds the latest results so the summary never reads a stale render.
  const report = useCallback<Report>((id, status, detail) => {
    const previous = resultsRef.current[id];
    if (previous.status === status && previous.detail === detail) return;
    if (previous.status !== status) console.info(`[beluga check] ${id}: ${status}. ${detail}`);
    resultsRef.current = { ...resultsRef.current, [id]: { status, detail } };
    setResults(resultsRef.current);
  }, []);

  const onLive = useCallback((stats: LiveStats) => {
    liveRef.current = stats;
    setLive({ ...stats, fov: { ...stats.fov } });
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    // Taps on this page must not also fire an XR select.
    const stopSelect = (e: Event) => e.preventDefault();
    overlay?.addEventListener("beforexrselect", stopSelect);

    const checkEnvironment = async () => {
      report(
        "secure",
        window.isSecureContext ? "pass" : "fail",
        window.isSecureContext ? location.origin : `${location.origin} is not secure: use HTTPS or localhost`,
      );

      const mode = displayMode();
      report(
        "installed",
        mode === "browser" ? "warn" : "pass",
        mode === "browser"
          ? "browser tab: install from Chrome's menu, then run this again from the home screen"
          : `installed app (display mode ${mode})`,
      );

      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { xrCompatible: true, alpha: true, antialias: false });
      glRef.current = gl;
      report("webgl2", gl ? "pass" : "fail", gl ? (gl.getParameter(gl.VERSION) as string) : "no WebGL 2 context");

      if (!navigator.xr) {
        report("webxr", "fail", "navigator.xr is missing: use Chrome on an ARCore phone");
      } else {
        try {
          const supported = await navigator.xr.isSessionSupported("immersive-ar");
          report("webxr", supported ? "pass" : "fail", supported ? "immersive-ar supported" : "immersive-ar not supported");
          setXrReady(supported && gl !== null);
        } catch (err) {
          report("webxr", "fail", errorText(err));
        }
      }

      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        setAskLocation(permission.state === "prompt");
      } catch {
        setAskLocation(true);
      }
    };
    void checkEnvironment();
    const stopCompass = watchCompass(report, "compass");

    const cleanups = cleanupRef.current;
    return () => {
      overlay?.removeEventListener("beforexrselect", stopSelect);
      stopCompass();
      cleanups.forEach((fn) => fn());
      void sessionRef.current?.end().catch(() => {});
    };
  }, [report]);

  const summary = useCallback(
    () => ({
      at: new Date().toISOString(),
      userAgent: navigator.userAgent,
      displayMode: displayMode(),
      checks: resultsRef.current,
      live: liveRef.current,
    }),
    [],
  );

  const finish = useCallback(() => {
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];
    for (const [id, result] of Object.entries(resultsRef.current)) {
      if (result.status === "running") report(id as CheckId, "warn", `${result.detail} (no result before the test ended)`);
    }
    setAudioQuestion(false);
    setPhase("done");
    const result = summary();
    console.info("[beluga check] summary", result);
    // Lands in the dev server terminal (or Vercel logs), so results are readable off the phone.
    void fetch("/api/device-check", { method: "POST", body: JSON.stringify(result) }).catch(() => {});
  }, [report, summary]);

  const allowLocation = () => {
    navigator.geolocation.getCurrentPosition(
      () => setAskLocation(false),
      (err) => report("location", "fail", `${err.message} (code ${err.code})`),
      { enableHighAccuracy: true, timeout: 30_000 },
    );
  };

  const playTones = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx) return;
    setAudioQuestion(false);
    report("audio", "running", "listen: left, then centre, then right");
    const ms = playSweep(ctx);
    window.setTimeout(() => {
      report("audio", "running", `did you hear left, centre, right? ${describeLatency(ctx)}`);
      setAudioQuestion(true);
    }, ms);
  }, [report]);

  const answerAudio = (heard: boolean) => {
    const ctx = audioRef.current;
    const latency = ctx ? describeLatency(ctx) : "";
    report("audio", heard ? "pass" : "fail", `${heard ? "heard in order" : "not heard in order"}. ${latency}`);
    setAudioQuestion(false);
  };

  const start = () => {
    for (const id of SESSION_CHECKS) report(id, "idle", "");
    setCopied(false);

    // requestSession comes first in the tap with nothing awaited before it, or Chrome
    // can lose the user gesture.
    const overlay = overlayRef.current;
    const gl = glRef.current;
    let sessionRequest: Promise<XRSession> | null = null;
    if (xrReady && navigator.xr && overlay && gl) {
      sessionRequest = navigator.xr.requestSession("immersive-ar", sessionInit(overlay));
    } else {
      report("session", "fail", "skipped: this browser has no immersive-ar");
    }

    audioRef.current ??= startAudio();
    playTones();
    cleanupRef.current.push(watchLocation(report));
    void requestWakeLock(report).then((lock) => {
      if (lock) cleanupRef.current.push(() => void lock.release());
    });
    setPhase("running");

    if (!sessionRequest || !gl) return;
    sessionRequest.then(
      (session) => {
        sessionRef.current = session;
        setInAr(true);
        cleanupRef.current.push(watchCompass(report, "compassInAr"));
        void runXrCheck({ session, gl, report, onLive, preview: previewRef.current })
          .catch((err) => report("session", "fail", errorText(err)))
          .finally(() => {
            sessionRef.current = null;
            setInAr(false);
            finish();
          });
      },
      (err) => report("session", "fail", errorText(err)),
    );
  };

  const end = () => {
    if (sessionRef.current) void sessionRef.current.end();
    else finish();
  };

  const copyResults = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary(), null, 2));
      setCopied(true);
    } catch (err) {
      console.warn("[beluga check] copy failed", err);
    }
  };

  const fov = live?.fov;

  return (
    <div
      ref={overlayRef}
      className={`min-h-dvh w-full ${inAr ? "bg-transparent" : "bg-background"} text-foreground`}
    >
      {inAr && (
        <div aria-hidden className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-yellow-300 shadow-[0_0_0_2px_black]" />
        </div>
      )}

      <main className="relative mx-auto flex max-w-xl flex-col gap-4 p-4">
        {!inAr && (
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">beluga device check</h1>
            <p>Checks that this phone gives depth, camera frames, spatial sound, wake lock and location together.</p>
            <ol className="list-decimal space-y-1 pl-6 text-sm text-neutral-300">
              <li>Connect the bone-conduction earbuds.</li>
              <li>Tap Start test. You hear a tone on the left, then ahead, then on the right.</li>
              <li>Move the phone slowly. Aim the ring at a wall 1 m away, then 2 m, and compare with a tape measure.</li>
              <li>Turn the phone sideways to measure the landscape view (auto-rotate on).</li>
              <li>Point the phone at the floor for the hit test, then tap End test.</li>
              <li>Install the app from Chrome&apos;s menu and run the test again from the home screen.</li>
            </ol>
          </header>
        )}

        {inAr && live && (
          <section aria-live="off" className="rounded-lg bg-black/70 p-3 text-white">
            <p className="text-5xl font-bold tabular-nums">
              {live.centreDepth === null ? "no depth" : `${live.centreDepth.toFixed(2)} m`}
            </p>
            <p className="text-sm tabular-nums">
              {live.fps.toFixed(0)} frames/s
              {live.depthValidShare !== null && `, ${Math.round(live.depthValidShare * 100)}% depth valid`}
              {live.hitFloorBelowPhone !== null && `, floor ${live.hitFloorBelowPhone.toFixed(2)} m below`}
              {live.trackingLost && ", tracking lost"}
            </p>
            <p className="text-sm tabular-nums">
              Portrait {fov?.portrait ? `${fov.portrait.horizontal.toFixed(0)}° × ${fov.portrait.vertical.toFixed(0)}°` : "-"}
              {" / "}
              Landscape{" "}
              {fov?.landscape ? `${fov.landscape.horizontal.toFixed(0)}° × ${fov.landscape.vertical.toFixed(0)}°` : "-"}
            </p>
          </section>
        )}

        <canvas
          ref={previewRef}
          aria-label="Camera preview"
          className={`w-40 self-end rounded border border-neutral-500 ${results.camera.status === "pass" ? "" : "hidden"}`}
        />

        {phase !== "running" && (
          <div className="flex flex-col gap-3">
            {askLocation && (
              <button
                type="button"
                onClick={allowLocation}
                className="min-h-16 rounded-lg border-2 border-yellow-300 px-4 text-lg font-semibold"
              >
                Allow location first
              </button>
            )}
            <button
              type="button"
              onClick={start}
              className="min-h-24 rounded-lg bg-yellow-300 px-4 text-2xl font-bold text-black"
            >
              {phase === "done" ? "Run the test again" : "Start test"}
            </button>
          </div>
        )}

        {audioQuestion && (
          <div className="flex flex-col gap-2 rounded-lg bg-black/80 p-3 text-white">
            <p className="font-semibold">Did you hear left, then centre, then right?</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => answerAudio(true)} className="min-h-16 rounded bg-emerald-700 font-semibold">
                Yes
              </button>
              <button type="button" onClick={() => answerAudio(false)} className="min-h-16 rounded bg-red-700 font-semibold">
                No
              </button>
              <button type="button" onClick={playTones} className="min-h-16 rounded bg-neutral-700 font-semibold">
                Play again
              </button>
            </div>
          </div>
        )}

        <ul className={`flex flex-col gap-2 ${inAr ? "max-h-[40dvh] overflow-y-auto rounded-lg bg-black/70 p-2 text-white" : ""}`}>
          {CHECKS.map(({ id, label }) => {
            const result = results[id];
            return (
              <li key={id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-16 shrink-0 rounded px-1 py-0.5 text-center text-xs font-bold uppercase ${STATUS_CLASS[result.status]}`}
                >
                  {STATUS_TEXT[result.status]}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{label}</span>
                  {result.detail && <span className="text-sm opacity-80">{result.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>

        {phase === "running" && (
          <button
            type="button"
            onClick={end}
            className="sticky bottom-4 min-h-20 rounded-lg bg-red-700 px-4 text-2xl font-bold text-white"
          >
            End test
          </button>
        )}

        {phase === "done" && (
          <button
            type="button"
            onClick={copyResults}
            className="min-h-16 rounded-lg border-2 border-neutral-400 px-4 text-lg font-semibold"
          >
            {copied ? "Copied" : "Copy results"}
          </button>
        )}
      </main>
    </div>
  );
}
