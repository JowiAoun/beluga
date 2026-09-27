"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconCopy,
  IconInfoCircle,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconProgress,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CARD } from "@/components/brand/Card";
import { DISPLAY, Name } from "@/components/brand/Display";
import { BelugaMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
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
import { ArUnavailableError, requestArSession, SESSION_LEVELS, type Requested } from "@/lib/xr/request";
import { runXrCheck, type LiveStats } from "./xrCheck";
import { DANGER, PANEL, PRIMARY, SECONDARY } from "../styles";

type Phase = "ready" | "running" | "done";

const STATUS_TEXT: Record<CheckStatus, string> = {
  idle: "not run",
  running: "running",
  pass: "pass",
  warn: "check",
  fail: "fail",
  info: "info",
};

// Running is filled and "check" is outlined, so the two blues differ by more than shade.
const STATUS_CLASS: Record<CheckStatus, string> = {
  idle: "border border-line text-muted",
  running: "bg-accent/15 text-sonar",
  pass: "bg-emerald-400/15 text-emerald-300",
  warn: "border border-accent text-foreground",
  fail: "bg-red-500/20 text-red-300",
  info: "bg-line text-foreground",
};

// Always next to the word, so the result never rests on colour alone. No spinner: the test runs
// inside AR, where the GPU is busy.
const STATUS_ICON: Record<CheckStatus, typeof IconCheck> = {
  idle: IconCircleDashed,
  running: IconProgress,
  pass: IconCircleCheck,
  warn: IconAlertTriangle,
  fail: IconCircleX,
  info: IconInfoCircle,
};

const SESSION_CHECKS = [
  "session",
  "setup",
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
          report(
            "webxr",
            supported ? "pass" : "fail",
            supported ? "immersive-ar supported" : "immersive-ar not supported",
          );
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
    const cameraMode = typeof navigator.mediaDevices?.getUserMedia === "function";
    const motion = typeof DeviceOrientationEvent !== "undefined";
    report(
      "cameraMode",
      cameraMode ? "pass" : "fail",
      cameraMode
        ? `camera ready to ask for, ${motion ? "motion sensors present" : "no motion sensors, so the phone is taken as upright"}`
        : "no getUserMedia in this browser",
    );
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
      if (result.status === "running")
        report(id as CheckId, "warn", `${result.detail} (no result before the test ended)`);
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
    let sessionRequest: Promise<Requested> | null = null;
    if (xrReady && navigator.xr && overlay && gl) {
      // From the top every time, so the check names each setup this phone refuses. The walk then
      // starts from the one that worked.
      sessionRequest = requestArSession(navigator.xr, overlay, 0);
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
      ({ session, level, refused }) => {
        report(
          "setup",
          level === 0 ? "pass" : "warn",
          level === 0
            ? "every feature: depth, camera, hit test, DOM overlay, local-floor"
            : `${SESSION_LEVELS[level].name}, after the phone refused ${refused.join("; ")}`,
        );
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
      (err) => {
        report("session", "fail", errorText(err));
        if (err instanceof ArUnavailableError) {
          report("setup", "fail", `every AR setup refused, so the walk uses camera mode. ${err.refused.join("; ")}`);
        }
      },
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
    // Chrome shows this box full screen during the AR check, so it scrolls itself then.
    <div
      ref={overlayRef}
      className={`w-full ${inAr ? "h-dvh overflow-y-auto overscroll-contain bg-transparent" : "min-h-dvh bg-background"} text-foreground`}
    >
      {inAr && (
        <div aria-hidden className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-accent shadow-[0_0_0_2px_black]" />
        </div>
      )}

      <main className="relative mx-auto flex max-w-xl flex-col gap-5 px-4 pt-safe pb-12">
        {!inAr && (
          <header className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <BelugaMark size={64} className="size-14" />
              <h1 className={cn(DISPLAY, "text-4xl sm:text-5xl")}>
                <Name /> device check
              </h1>
            </div>
            <p className="text-xl text-muted">
              Checks that this phone gives depth, camera frames, spatial sound, wake lock and location together.
            </p>
            <ol
              className={cn(
                PANEL,
                "list-decimal space-y-2 pl-11 text-lg marker:font-mono marker:font-medium marker:text-sonar",
              )}
            >
              <li>Connect the bone-conduction earbuds.</li>
              <li>Tap Start test. You hear a tone on the left, then ahead, then on the right.</li>
              <li>
                Move the phone slowly. Aim the ring at a wall 1 m away, then 2 m, and compare with a tape measure.
              </li>
              <li>Turn the phone sideways to measure the landscape view (auto-rotate on).</li>
              <li>Point the phone at the floor for the hit test, then tap End test.</li>
              <li>Install the app from Chrome&apos;s menu and run the test again from the home screen.</li>
            </ol>
          </header>
        )}

        {inAr && live && (
          <section aria-live="off" className="border border-line bg-abyss/85 p-3 text-foreground">
            <p className="font-mono text-5xl font-medium tabular-nums">
              {live.centreDepth === null ? "no depth" : `${live.centreDepth.toFixed(2)} m`}
            </p>
            <p className="text-sm tabular-nums">
              {live.fps.toFixed(0)} frames/s
              {live.depthValidShare !== null && `, ${Math.round(live.depthValidShare * 100)}% depth valid`}
              {live.hitFloorBelowPhone !== null && `, floor ${live.hitFloorBelowPhone.toFixed(2)} m below`}
              {live.trackingLost && ", tracking lost"}
            </p>
            <p className="text-sm tabular-nums">
              Portrait{" "}
              {fov?.portrait ? `${fov.portrait.horizontal.toFixed(0)}° × ${fov.portrait.vertical.toFixed(0)}°` : "-"}
              {" / "}
              Landscape{" "}
              {fov?.landscape ? `${fov.landscape.horizontal.toFixed(0)}° × ${fov.landscape.vertical.toFixed(0)}°` : "-"}
            </p>
          </section>
        )}

        <canvas
          ref={previewRef}
          aria-label="Camera preview"
          className={`w-40 self-end border border-line-strong ${results.camera.status === "pass" ? "" : "hidden"}`}
        />

        {phase !== "running" && (
          <div className="flex flex-col gap-3">
            {askLocation && (
              <button type="button" onClick={allowLocation} className={SECONDARY}>
                Allow location first
              </button>
            )}
            <button type="button" onClick={start} className={cn(PRIMARY, "min-h-24 text-2xl")}>
              {phase === "done" ? (
                <IconRefresh aria-hidden size={28} />
              ) : (
                <IconPlayerPlayFilled aria-hidden size={28} />
              )}
              {phase === "done" ? "Run the test again" : "Start test"}
            </button>
          </div>
        )}

        {audioQuestion && (
          <div className="flex flex-col gap-3 border border-line bg-abyss/90 p-4 text-foreground">
            <p className="text-xl font-semibold">Did you hear left, then centre, then right?</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => answerAudio(true)}
                className="flex min-h-16 items-center justify-center gap-1.5 rounded-md border border-emerald-300/50 bg-emerald-900/70 text-lg font-bold"
              >
                <IconCheck aria-hidden size={22} />
                Yes
              </button>
              <button
                type="button"
                onClick={() => answerAudio(false)}
                className="flex min-h-16 items-center justify-center gap-1.5 rounded-md bg-danger text-lg font-bold text-white"
              >
                <IconX aria-hidden size={22} />
                No
              </button>
              <button
                type="button"
                onClick={playTones}
                className="min-h-16 rounded-md border border-line-strong bg-surface px-1 text-lg leading-tight font-bold"
              >
                Play again
              </button>
            </div>
          </div>
        )}

        <ul
          className={cn(
            "flex flex-col gap-2",
            inAr && "max-h-[40dvh] overflow-y-auto border border-line bg-abyss/85 p-2 text-foreground",
          )}
        >
          {CHECKS.map(({ id, label }) => {
            const result = results[id];
            const Icon = STATUS_ICON[result.status];
            return (
              <li key={id} className={cn(CARD, "flex items-start gap-3 p-3")}>
                <span
                  className={cn(
                    "mt-0.5 flex w-28 shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-bold uppercase",
                    STATUS_CLASS[result.status],
                  )}
                >
                  <Icon aria-hidden size={18} className="shrink-0" />
                  {STATUS_TEXT[result.status]}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-lg leading-snug font-semibold">{label}</span>
                  {result.detail && <span className="text-base break-words text-muted">{result.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>

        {phase === "running" && (
          <button type="button" onClick={end} className={cn(DANGER, "sticky bottom-4 min-h-20 text-2xl")}>
            <IconPlayerStopFilled aria-hidden size={28} />
            End test
          </button>
        )}

        {phase === "done" && (
          <button type="button" onClick={copyResults} className={SECONDARY}>
            {copied ? <IconCheck aria-hidden size={24} /> : <IconCopy aria-hidden size={24} />}
            {copied ? "Copied" : "Copy results"}
          </button>
        )}
      </main>
    </div>
  );
}
