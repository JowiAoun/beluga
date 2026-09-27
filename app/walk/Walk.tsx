"use client";

import {
  IconAlertTriangle,
  IconBellOff,
  IconChevronRight,
  IconHeadphones,
  IconInfoCircle,
  IconMapPin,
  IconPlayerPlayFilled,
} from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/engine";
import { decodeLibrary, fetchLibrary, isClipId, type RawLibrary } from "@/lib/audio/library";
import { DetectPipeline } from "@/lib/detect/pipeline";
import { withStrip } from "@/lib/detect/strip";
import { CameraOnlyEngine } from "@/lib/hazard/cameraOnly";
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
import { CameraDeniedError, startCameraSensing } from "@/lib/xr/cameraSession";
import { ArUnavailableError, forgetLevel, savedLevel, SESSION_LEVELS } from "@/lib/xr/request";
import type { SensingUpdate } from "@/lib/xr/types";
import { WalkBeluga } from "./WalkBeluga";
import { detectionReady } from "@/lib/xr/readiness";
import { askAboutView } from "./ask";
import { encodeClip } from "@/lib/replay/format";
import { CLIP_SECONDS, Recorder } from "@/lib/replay/recorder";
import FirstRun, { type FirstRunResult } from "./FirstRun";
import ReplayPlayer from "./ReplayPlayer";
import { Reporting } from "./reporting";
import { DEFAULT_SETTINGS, readSettings, saveSettings, type Settings } from "./settings";
import SettingsPanel from "./SettingsPanel";
import { heardHazards, offText } from "./warnings";
import VibrationControls from "./VibrationControls";
import { HapticEngine } from "@/lib/haptics/engine";
import AskButton from "./AskButton";
import DebugOverlay, { type DebugView } from "./DebugOverlay";
import { startHeadsetButton } from "./headset";
import { askLocation, locationPermission, watchLocation, type Fix } from "./location";
import StopButton from "./StopButton";
import MicrophoneSetup from "./MicrophoneSetup";
import VoiceAsk from "./VoiceAsk";
import { LINES, say, speakLocalText, speakText, unlockVoice } from "./voice";
import { Contours } from "@/components/brand/Contours";
import { cn } from "@/lib/utils";
import { CHECKBOX, LINK_ROW, PANEL, PRIMARY, SECONDARY } from "./styles";

type Phase = "ready" | "starting" | "running" | "ended";
// ok: WebXR AR. camera: camera mode, for a browser without AR (an iPhone) or a phone that refused
// every AR setup. none: neither.
type Support = "checking" | "ok" | "camera" | "none";
type Mode = "ar" | "camera";

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
  // The last Ask, for the debug overlay.
  lastAsk: { ms: number; outcome: string } | null;
}

const RECENT_EVENTS = 5;
const CAMERA_HELP =
  "beluga needs the camera. On an iPhone, tap aA in Safari's address bar, then Website Settings, and set Camera " +
  "to Allow. In Chrome, tap the icon left of the address, then Permissions, and allow Camera. Then tap Start again.";
// Start waits this long at most for the recorded sounds.
const SOUNDS_WAIT_MS = 8000;

function freshLatest(fix: Fix | null = null): Latest {
  return { update: null, nearest: null, fix, granted: null, hazards: [], events: [], floorSlope: null, lastAsk: null };
}

export default function Walk() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const sessionRef = useRef<SensingSession | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef<AudioEngine | null>(null);
  const hapticsRef = useRef<HapticEngine | null>(null);
  const libraryRef = useRef<RawLibrary | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const debugRef = useRef(false);
  const latestRef = useRef<Latest>(freshLatest());
  const engineRef = useRef<HazardEngine | null>(null);
  // Camera-only mode (Phase 10) swaps the depth engine for one that reads detector boxes.
  const cameraEngineRef = useRef<CameraOnlyEngine | null>(null);
  const cameraOnlyRef = useRef(false);
  const [cameraOnly, setCameraOnly] = useState(false);
  const estimatesConfirmedRef = useRef(false);
  const [estimatesConfirmed, setEstimatesConfirmed] = useState(false);
  const detectRef = useRef<DetectPipeline | null>(null);
  const reportingRef = useRef<Reporting | null>(null);

  const [support, setSupport] = useState<Support>("checking");
  // Camera mode shows the camera here, behind the buttons.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("ar");
  const arSupportedRef = useRef(false);
  const [needLocation, setNeedLocation] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [session, setSession] = useState<SensingSession | null>(null);
  const [debug, setDebug] = useState(false);
  const [view, setView] = useState<DebugView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [asking, setAsking] = useState(false);
  // The earbuds' button calls the latest ask, set after each render.
  const askRef = useRef<() => void>(() => {});
  const [reportingOn, setReportingOn] = useState(false);
  // Null until read from storage, so the first-run steps never flash for a returning user.
  const [settings, setSettings] = useState<Settings | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  // `?replay=<file>` plays a recorded walk instead (Phase 10). Null until the address is read.
  const [replaySrc, setReplaySrc] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const lastClipRef = useRef<Blob | null>(null);
  const [hasClip, setHasClip] = useState(false);

  // Keeps the clip for "save again", and downloads it now.
  const saveClip = async (recorder: Recorder) => {
    const blob = await encodeClip(recorder.clip());
    lastClipRef.current = blob;
    setHasClip(true);
    download(blob);
  };
  const [microphone, setMicrophone] = useState("");
  const [soundsLoading, setSoundsLoading] = useState(true);
  const [soundStatus, setSoundStatus] = useState("Preparing offline sounds…");

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
      arSupportedRef.current = supported;
      setSupport(supportFor(supported));
      const permission = await locationPermission();
      setNeedLocation(permission === "prompt");
      setLocationGranted(permission === "granted");
      const on = readDebugDefault();
      debugRef.current = on;
      setDebug(on);
      setReportingOn(reportingRef.current?.isOn() ?? false);
      setReplaySrc(new URLSearchParams(window.location.search).get("replay"));
      const saved = readSettings();
      settingsRef.current = saved;
      setSettings(saved);
    };
    void check();
    // After this visit, a walk starts and warns with no network (Phase 9). Production only: in
    // development it would serve stale code from its cache.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      // This page's code loaded before the worker could see it; hand it the list to keep.
      void navigator.serviceWorker.ready.then((registration) => {
        const urls = performance.getEntriesByType("resource").map((entry) => entry.name);
        registration.active?.postMessage({ type: "cache", urls });
      });
    }
    // The recorded sounds download now, so the walk itself needs no network. A slow network
    // doesn't hold Start back for long: tones play until the recorded sounds arrive.
    const soundsWait = window.setTimeout(() => setSoundsLoading(false), SOUNDS_WAIT_MS);
    void fetchLibrary().then((raw) => {
      window.clearTimeout(soundsWait);
      libraryRef.current = raw;
      setSoundsLoading(false);
      // A walk that started on tones takes the recorded sounds now.
      const sound = soundRef.current;
      const ctx = audioRef.current;
      if (raw && sound && ctx) void decodeLibrary(ctx, raw).then((library) => sound.useLibrary(library));
      setSoundStatus(
        raw?.offlineReady
          ? "Spoken labels saved on this device for offline playback."
          : "Offline tones are ready. Recorded labels could not be saved; a local device voice may be used.",
      );
    });
    // Reporting starts off until the user turns it on; an older consent counts as off.
    reportingRef.current ??= new Reporting();
    // The detector model loads now too, ready for the first walk. `?detector=cpu` keeps it off
    // the GPU and `?detector=off` turns it off, to compare update rates on the phone.
    const detect = (detectRef.current ??= new DetectPipeline());
    const choice = new URLSearchParams(window.location.search).get("detector");
    if (choice === "off") detect.disable();
    else void detect.load(choice === "cpu" ? "CPU" : "GPU");

    return () => {
      window.clearTimeout(soundsWait);
      overlay?.removeEventListener("beforexrselect", stopSelect);
      sessionRef.current?.stop();
      runCleanups();
    };
  }, [runCleanups]);

  // Numbers for the overlay refresh a few times a second, not on every update.
  useEffect(() => {
    if (phase !== "starting" && phase !== "running") return;
    const id = window.setInterval(() => {
      const recorder = recorderRef.current;
      if (recorder) {
        setRecording(recorder.done ? null : recorder.seconds());
        if (recorder.done) {
          recorderRef.current = null;
          void saveClip(recorder);
        }
      }
      setView({
        ...latestRef.current,
        stats: sessionRef.current?.stats() ?? null,
        audio: soundRef.current?.stats() ?? null,
        detect: detectRef.current?.stats() ?? null,
        reporting: reportingRef.current?.stats() ?? null,
      });
    }, DEBUG_OVERLAY.refreshMs);
    return () => window.clearInterval(id);
  }, [phase]);

  const onUpdate = useCallback((update: SensingUpdate) => {
    const latest = latestRef.current;
    latest.update = update;
    const ready = detectionReady(update, cameraOnlyRef.current, estimatesConfirmedRef.current);
    const detect = detectRef.current;
    detect?.setEnabled(ready, update.t);
    if (!ready) {
      hapticsRef.current?.stop();
      engineRef.current?.reset();
      cameraEngineRef.current?.reset();
      soundRef.current?.update([], update);
      soundRef.current?.stopAnswer();
      latest.nearest = null;
      latest.hazards = [];
      latest.floorSlope = null;
      return;
    }
    recorderRef.current?.add(update, detectRef.current?.latestDetections() ?? []);
    // Out to the full depth range, so the tape-measure check works past the corridor's 3 m.
    latest.nearest = update.tracking ? nearestAhead(update, SENSING.depthMaxM) : null;
    // Called in both modes: it also hands the detector the view's width.
    const labelFor = detect?.labelFor(update);
    const result = cameraOnlyRef.current
      ? cameraEngineRef.current?.update(update, detect?.latestDetections() ?? [])
      : engineRef.current?.update(update, labelFor);
    if (!result) return;
    const reporting = reportingRef.current;
    // A yellow edge strip plays like a drop-off, but only the sounds hear it: it never reaches the
    // frame gate or the events. While tracking is lost the list is empty, so every warning goes quiet.
    const found = update.tracking && !cameraOnlyRef.current
      ? withStrip(result.hazards, detect?.stripFor(update) ?? null)
      : result.hazards;
    // Leaves out the warnings turned off in Settings. Reports still see every hazard.
    const heard = heardHazards(found, settingsRef.current.warningsOff, !cameraOnlyRef.current);
    soundRef.current?.update(heard, update, reporting?.blocked);
    hapticsRef.current?.update(heard, ready, performance.now());
    const gate = detect?.check(update, result.hazards, latest.fix);
    const session = sessionRef.current;
    if (reporting) {
      reporting.record(result.events, latest.fix);
      if (gate?.fire && session) {
        void reporting.triage(
          gate.fire,
          session,
          latest.fix,
          (on) => detect?.setTriageInFlight(on),
          () => {
            if (settingsRef.current.reportedSound) soundRef.current?.play("reported");
          },
        );
      }
    }
    latest.hazards = heard;
    if (result.floor) latest.floorSlope = result.floor.slope;
    if (result.events.length > 0)
      latest.events = [...result.events.reverse(), ...latest.events].slice(0, RECENT_EVENTS);
  }, []);

  // Recorded clips where there is one; the phone's voice for the rest.
  const onCue = useCallback((cue: Cue) => {
    if (cue === "calibrated") hapticsRef.current?.calibrated(performance.now());
    if (soundRef.current && isClipId(cue)) soundRef.current.say([cue]);
    else speakLocalText(LINES[cue]);
  }, []);

  const onEnd = useCallback(
    (result: SessionSummary) => {
      // A recording cut short by the end of the walk is still saved.
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setRecording(null);
      if (recorder && recorder.seconds() > 0) void saveClip(recorder);
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
        const outputLatencyMs = ctx ? Math.round(((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000) : null;
        // Lands in the dev server terminal (or Vercel logs) for testers. No location in it.
        void fetch("/api/device-check", {
          method: "POST",
          body: JSON.stringify({ kind: "walk", ...result, outputLatencyMs }),
        }).catch(() => {});
      }
    },
    [runCleanups],
  );

  const start = (how: Mode = support === "camera" ? "camera" : "ar") => {
    const overlay = overlayRef.current;
    const gl = glRef.current;
    if (soundsLoading) return;
    estimatesConfirmedRef.current = false;
    setEstimatesConfirmed(false);
    const video = videoRef.current;
    let started: SensingSession;
    // Each start call asks for the session before anything else in this tap: requestSession for
    // AR, the motion sensors and the camera for camera mode.
    if (how === "camera") {
      if (!video) return;
      started = startCameraSensing({ video, userHeightM: settingsRef.current.heightM, onUpdate, onCue, onEnd });
    } else {
      if (!overlay || !gl) return;
      started = startSensing({ overlayRoot: overlay, gl, onUpdate, onCue, onEnd });
    }
    sessionRef.current = started;
    setMode(how);
    playAsMedia();

    // The same tap has to resume audio and unlock speech, or Chrome keeps both silent.
    const ctx = (audioRef.current ??= new AudioContext({ latencyHint: "interactive" }));
    void ctx.resume();
    unlockVoice();
    const sound = new AudioEngine(ctx, { speak: speakLocalText });
    sound.start();
    sound.setVolume(settingsRef.current.volumeDb);
    sound.setAliveTick(settingsRef.current.aliveTick);
    sound.setOneSound(settingsRef.current.oneSound);
    sound.setWords(settingsRef.current.spokenNames);
    soundRef.current = sound;
    const haptics = new HapticEngine(settingsRef.current);
    hapticsRef.current = haptics;
    const stopHapticsWhenHidden = () => { if (document.hidden) haptics.stop(); };
    document.addEventListener("visibilitychange", stopHapticsWhenHidden);
    cleanupRef.current.push(() => {
      haptics.stop();
      if (hapticsRef.current === haptics) hapticsRef.current = null;
      document.removeEventListener("visibilitychange", stopHapticsWhenHidden);
    });
    // Tones play until the library is decoded, a moment later.
    const raw = libraryRef.current;
    if (raw) void decodeLibrary(ctx, raw).then((library) => sound.useLibrary(library));
    cleanupRef.current.push(() => {
      sound.stop();
      if (soundRef.current === sound) soundRef.current = null;
    });
    // The silent clip behind the earbuds' button needs this tap to play.
    if (settingsRef.current.headsetAsk) cleanupRef.current.push(startHeadsetButton(() => askRef.current()));
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
    // The head-height top follows the user's height.
    engineRef.current = new HazardEngine(settingsRef.current.heightM);
    cameraEngineRef.current = new CameraOnlyEngine();
    cameraOnlyRef.current = how === "camera" || settingsRef.current.cameraOnly;
    setCameraOnly(cameraOnlyRef.current);
    const detect = detectRef.current;
    if (detect) {
      detect.setStrip(settingsRef.current.yellowStrip);
      cleanupRef.current.push(detect.attach(started));
    }
    const reporting = reportingRef.current;
    if (reporting) {
      reporting.setStation(settingsRef.current.station);
      reporting.start();
      cleanupRef.current.push(() => reporting.stop());
    }
    setSession(started);
    setMessage(null);
    setSummary(null);
    setView(null);
    setPhase("starting");

    started.ready.then(
      async (granted) => {
        latestRef.current.granted = granted;
        setPhase((p) => (p === "starting" ? "running" : p));
        if (!granted.depth && granted.camera) await detectRef.current?.load();
        // Without depth, the detector's boxes are all that is left to warn with.
        const detectorOk = detectRef.current?.stats().state !== "failed";
        if (!granted.depth && (!granted.camera || !detectorOk)) {
          cameraOnlyRef.current = how === "camera";
          setCameraOnly(cameraOnlyRef.current);
          say("no_depth");
          const detectorError = detectRef.current?.stats().error;
          setMessage(
            detectorError ? `No depth is available, and the object detector failed: ${detectorError}` : LINES.no_depth,
          );
        } else if (!granted.depth || cameraOnlyRef.current) {
          cameraOnlyRef.current = true;
          setCameraOnly(true);
          say("camera_only");
          setMessage(LINES.camera_only);
        }
      },
      (err: unknown) => {
        if (sessionRef.current === started) sessionRef.current = null;
        setSession(null);
        runCleanups();
        setPhase("ready");
        // The phone refused every AR setup: camera mode from here on, starting now.
        if (err instanceof ArUnavailableError && supportFor(false) === "camera") {
          setSupport("camera");
          start("camera");
          return;
        }
        if (err instanceof CameraDeniedError) {
          say("camera_denied");
          setMessage(CAMERA_HELP);
          return;
        }
        say("start_failed");
        setMessage(`beluga could not start: ${errorText(err)}`);
      },
    );
  };

  // One frame to the Ask agent; the answer plays from the object's side, under any warning.
  const ask = async () => {
    const update = latestRef.current.update;
    if (!detectionReady(update, cameraOnlyRef.current, estimatesConfirmedRef.current)) return;
    const session = sessionRef.current;
    const ctx = audioRef.current;
    const sound = soundRef.current;
    if (!session || !ctx || !sound || asking) return;
    setAsking(true);
    sound.play("listening");
    const began = performance.now();
    try {
      const result = await askAboutView(session, ctx, latestRef.current.update?.fov.horizontal ?? 40);
      if (sessionRef.current !== session || !detectionReady(
        latestRef.current.update, cameraOnlyRef.current, estimatesConfirmedRef.current,
      )) return;
      if (result.kind === "audio") sound.playAnswer(result.buffer, result.pan);
      else if (result.kind === "text") speakText(result.meta.answer);
      else say(result.kind === "offline" ? "ask_offline" : "sorry");
      const outcome = result.kind === "text" && result.meta.voiceFailed ? "phone voice" : result.kind;
      latestRef.current.lastAsk = { ms: Math.round(performance.now() - began), outcome };
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    askRef.current = () => void ask();
  });

  const record = () => {
    recorderRef.current = new Recorder();
    setRecording(0);
  };

  const changeSettings = (next: Settings) => {
    hapticsRef.current?.configure(next);
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
  };

  const finishFirstRun = (result: FirstRunResult) => {
    reportingRef.current?.setOn(result.reporting);
    setReportingOn(result.reporting);
    changeSettings({ ...settingsRef.current, heightM: result.heightM, firstRunDone: true });
  };

  const toggleReporting = () => {
    const reporting = reportingRef.current;
    if (!reporting) return;
    const next = !reporting.isOn();
    reporting.setOn(next);
    setReportingOn(next);
    say(next ? "reporting_on" : "reporting_off");
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

  if (replaySrc !== null) return <ReplayPlayer src={replaySrc} />;

  const inAr = phase === "starting" || phase === "running";
  const update = view?.update ?? null;
  const ready = detectionReady(update, cameraOnly, estimatesConfirmed);
  let status: string | null = null;
  if (phase === "starting") status = "Starting";
  else if (update && !update.tracking) status = "Hold steady";
  else if (cameraOnly) status = estimatesConfirmed ? "Estimated warnings — no depth calibration" : "Camera-only setup — warnings paused";
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
      // During a walk this box fills the screen (Chrome's AR overlay, or camera mode), so it
      // scrolls itself when the debug numbers make it taller than the screen.
      className={`w-full ${inAr ? "h-dvh overflow-y-auto overscroll-contain bg-transparent" : "min-h-dvh bg-background"} text-foreground`}
    >
      <video
        ref={videoRef}
        aria-hidden="true"
        muted
        playsInline
        className={inAr && mode === "camera" ? "fixed inset-0 h-full w-full object-cover" : "hidden"}
      />
      {inAr ? (
        <main className="relative z-10 flex min-h-dvh flex-col justify-between gap-3 p-3">
          <div className="flex flex-col gap-2">
            {status && (
              <p
                role="status"
                aria-atomic="true"
                className={`self-start rounded-md border-2 bg-abyss px-4 py-3 text-2xl font-bold ${
                  status === "Calibrated" ? "border-accent text-accent" : "border-foreground text-foreground"
                }`}
              >
                {status}
              </p>
            )}
            {message && (
              <p role="alert" className="rounded-md bg-danger px-4 py-3 text-xl text-white">
                {message}
              </p>
            )}
            {debug && (
              <button
                type="button"
                onClick={record}
                disabled={recording !== null}
                className="min-h-12 self-start rounded-md border border-line-strong bg-abyss px-4 font-semibold text-foreground"
              >
                {recording === null
                  ? `Record a ${CLIP_SECONDS} s replay`
                  : `Recording, ${recording.toFixed(0)} of ${CLIP_SECONDS} s`}
              </button>
            )}
            {debug && <DebugOverlay view={view} session={session} />}
          </div>
          {!ready && <p role="status" className="rounded-lg bg-black/90 p-4 text-xl font-semibold text-white">
            {cameraOnly
              ? "This mode cannot calibrate the floor. Detection and sounds are paused. Estimated warnings have no drop-off or head-height detection."
              : "Obstacle detection and warning sounds are paused until calibration completes. Keep the floor in view while taking three slow steps."}
          </p>}
          {cameraOnly && !estimatesConfirmed && update?.tracking && <button
            type="button"
            onClick={() => { estimatesConfirmedRef.current = true; setEstimatesConfirmed(true); }}
            className="min-h-24 rounded-lg bg-yellow-300 p-4 text-2xl font-bold text-black"
          >Start estimated warnings</button>}
          {ready && <AskButton asking={asking} onAsk={() => void ask()} />}
          {phase === "running" && ready && session && <VoiceAsk
            session={session} microphone={microphone}
            getAudio={() => audioRef.current} getEngine={() => soundRef.current}
            getFov={() => latestRef.current.update?.fov.horizontal}
          />}
          <details className="rounded-lg bg-black/90 p-4 text-white">
            <summary className="min-h-16 cursor-pointer text-xl font-semibold">Vibration settings</summary>
            <VibrationControls settings={settings ?? DEFAULT_SETTINGS} onChange={(next) => changeSettings({ ...settingsRef.current, ...next })} />
          </details>
          <StopButton onStop={() => { hapticsRef.current?.stop(); sessionRef.current?.stop(); }} />
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-10 pb-16">
          <header className="relative isolate flex flex-col items-center gap-2 text-center">
            <Contours variant="a" className="-inset-x-4 -top-10 -z-10 h-96" />
            <WalkBeluga className="w-64 max-w-full" />
            <h1 className="font-display text-6xl font-extrabold tracking-[-0.04em]">beluga</h1>
            <p className="max-w-[34ch] text-xl text-balance text-muted">
              Plays a sound from the side of obstacles in your path. It works alongside your cane or guide dog, and it
              can miss things.
            </p>
          </header>

          {support === "camera" && (
            <p className="flex gap-3 rounded-md border border-accent bg-accent/5 p-4 text-lg">
              <IconInfoCircle aria-hidden size={24} className="mt-0.5 shrink-0 text-accent" />
              <span>
                This browser can&apos;t run AR, so beluga uses camera mode. It warns about things it can name, like
                people, bikes and chairs, and about yellow edge strips. It can&apos;t find steps or drop-offs.
              </span>
            </p>
          )}

          {support === "none" && (
            <p role="alert" className="flex gap-3 rounded-md border border-red-400/40 bg-danger/40 p-4 text-lg">
              <IconAlertTriangle aria-hidden size={24} className="mt-0.5 shrink-0 text-red-300" />
              <span>
                This browser can&apos;t start an AR session. Use Chrome on an Android phone with ARCore, and run the
                device check below to see what is missing.
              </span>
            </p>
          )}

          {settings && !settings.firstRunDone ? (
            <FirstRun
              heightM={settings.heightM}
              locationGranted={locationGranted}
              onAllowLocation={allowLocation}
              onDone={finishFirstRun}
            />
          ) : (
            <>
              {needLocation && (
                <div className={cn(PANEL, "flex flex-col gap-4")}>
                  <p className="flex gap-3 text-xl">
                    <IconMapPin aria-hidden size={24} className="mt-1 shrink-0 text-sonar" />
                    <span>
                      Location marks where hazard reports happen, to about 100 m. Chrome can&apos;t ask during a
                      session, so it asks now.
                    </span>
                  </p>
                  <button type="button" onClick={allowLocation} className={SECONDARY}>
                    Allow location
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => start()}
                disabled={support === "checking" || support === "none" || soundsLoading}
                className={cn(PRIMARY, "min-h-24 text-2xl")}
              >
                {!soundsLoading && support !== "checking" && <IconPlayerPlayFilled aria-hidden size={28} />}
                {soundsLoading
                  ? "Preparing sounds"
                  : support === "checking"
                    ? "Checking this phone"
                    : phase === "ended"
                      ? "Start again"
                      : "Start"}
              </button>

              <p role="status" className="-mt-1 text-center text-lg text-muted">
                {soundStatus}
              </p>
              {settings && settings.warningsOff.length > 0 && (
                <p className="flex gap-3 rounded-md border border-line-strong p-4 text-lg">
                  <IconBellOff aria-hidden size={24} className="mt-0.5 shrink-0 text-sonar" />
                  <span>
                    Warnings off: {offText(settings.warningsOff)}. Turn them back on in Settings.
                  </span>
                </p>
              )}
              <Link href="/walk/practice" className={SECONDARY}>
                <IconHeadphones aria-hidden size={24} />
                Learn the warning sounds
              </Link>
              <MicrophoneSetup value={microphone} onChange={setMicrophone} />

              {message && (
                <p role="alert" className="flex gap-3 rounded-md border border-red-400/40 bg-danger/40 p-4 text-xl">
                  <IconAlertTriangle aria-hidden size={24} className="mt-1 shrink-0 text-red-300" />
                  <span>{message}</span>
                </p>
              )}

              {summary && debug && <Summary summary={summary} />}

              <section className={cn(PANEL, "flex flex-col gap-2")}>
                <label className="flex min-h-16 items-center gap-4 text-xl font-semibold">
                  <input type="checkbox" checked={reportingOn} onChange={toggleReporting} className={CHECKBOX} />
                  Help the city: share anonymous hazard reports
                </label>
                <p className="text-lg text-muted">
                  Sent: the hazard type, its distance, a rough location within about 100 metres, and the time. Never
                  sent: images, audio, your exact location or who you are.
                </p>
              </section>

              {hasClip && (
                <button
                  type="button"
                  onClick={() => lastClipRef.current && download(lastClipRef.current)}
                  className={SECONDARY}
                >
                  Save the last replay again
                </button>
              )}

              {settings && (
                <SettingsPanel
                  settings={settings}
                  noDepth={support === "camera"}
                  onChange={changeSettings}
                  onRunSetup={() => {
                    // Setup again also tries every AR setup again, on a phone that refused some.
                    forgetLevel();
                    setSupport(supportFor(arSupportedRef.current));
                    changeSettings({ ...settings, firstRunDone: false });
                  }}
                />
              )}

              {debug && (
                <button
                  type="button"
                  onClick={() => reportingRef.current?.newReporter()}
                  className={cn(SECONDARY, "py-3 text-lg")}
                >
                  New demo reporter (a fresh device key, so a second staged report isn&apos;t dropped as a repeat)
                </button>
              )}

              <label className="flex min-h-16 items-center gap-4 px-1 text-lg text-muted">
                <input type="checkbox" checked={debug} onChange={toggleDebug} className={CHECKBOX} />
                Show the debug overlay (a three-finger tap also toggles it during a session)
              </label>
              <div className="flex flex-col gap-3">
                <Link href="/walk/check" className={LINK_ROW}>
                  Device check
                  <IconChevronRight aria-hidden size={24} className="shrink-0" />
                </Link>
                <Link href="/walk/sounds" className={LINK_ROW}>
                  Sound check and blindfold test
                  <IconChevronRight aria-hidden size={24} className="shrink-0" />
                </Link>
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}

// Saves a replay clip on the phone, for the player at /walk?replay= or a commit to public/replays.
function download(blob: Blob): void {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `beluga-replay-${stamp}.json.gz`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// AR when the browser has it and this phone hasn't refused every AR setup before. Otherwise camera
// mode, when there is a camera to ask for.
function supportFor(arSupported: boolean): Support {
  if (arSupported && savedLevel() < SESSION_LEVELS.length) return "ok";
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
    ? "camera"
    : "none";
}

// iOS mutes Web Audio with the ring switch unless the page says it plays media (Safari 17 and up).
function playAsMedia(): void {
  const audioSession = (navigator as { audioSession?: { type: string } }).audioSession;
  if (audioSession) audioSession.type = "playback";
}

function metres(value: number | null): string {
  return value === null ? "not measured" : `${value.toFixed(2)} m`;
}

// The last session's numbers against the Phase 1 targets.
function Summary({ summary }: { summary: SessionSummary }) {
  const { floor } = summary;
  return (
    <section className={cn(PANEL, "flex flex-col gap-1 text-lg tabular-nums")}>
      <h2 className="mb-1 text-xl font-bold">Last session</h2>
      <p>
        {Math.round(summary.durationS)} s, ended by {summary.reason}
        {summary.error && `: ${summary.error}`}
        {summary.setup && `, setup: ${summary.setup}`}
      </p>
      <p>
        {summary.updateRate.toFixed(1)} updates/s (target about 10), {summary.frameRate.toFixed(0)} frames/s
      </p>
      <p>Tracking lost {Math.round(summary.trackingLostShare * 100)}% of the time</p>
      <p>
        Depth valid{" "}
        {summary.depthValidShare === null ? "never" : `${Math.round(summary.depthValidShare * 100)}% of points`}
        {summary.depthUnsteadyShare ? `, ${Math.round(summary.depthUnsteadyShare * 100)}% left out as unsteady` : ""}
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
