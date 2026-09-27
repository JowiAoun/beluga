// Camera mode: beluga on a phone with no WebXR AR, such as an iPhone in Safari, or an Android phone
// that refuses every AR setup. The back camera comes through getUserMedia and the tilt from the
// motion sensors. There is no depth and no position tracking: the floor is taken to sit a chest
// height below the phone, and hazards come from the detector's boxes (camera-only mode). It hands
// the app the same updates and frames as the AR session. Nothing here uses the network.

import { CAMERA_MODE, DETECTOR, FRAMES, SENSING } from "@/lib/shared/params";
import { fitLongEdge } from "./cameraImage";
import { NO_DEPTH } from "./depth";
import { perspectiveFor, type FieldOfView } from "./projection";
import type {
  CapturedFrame,
  Cue,
  DetectorSink,
  EndReason,
  Granted,
  LiveStats,
  SensingSession,
  SessionSetup,
  SessionSummary,
} from "./session";
import type { Flat, SensingUpdate } from "./types";

export interface CameraSensingOptions {
  // Shows the camera behind the buttons. It must be in the page.
  video: HTMLVideoElement;
  // The phone sits at CAMERA_MODE.chestShare of this above the floor.
  userHeightM: number;
  onUpdate: (update: SensingUpdate) => void;
  // "tap_camera" when the browser won't play the camera until the next tap.
  onCue?: (cue: Cue) => void;
  // Called once when a session that started has ended, for any reason.
  onEnd: (summary: SessionSummary) => void;
}

// The camera was refused for this site, now or earlier.
export class CameraDeniedError extends Error {
  constructor() {
    super("the camera isn't allowed for this site");
    this.name = "CameraDeniedError";
  }
}

// Device orientation angles in degrees, as the W3C spec defines them.
export interface Tilt {
  alpha: number;
  beta: number;
  gamma: number;
}

// Upright and facing forward, for a phone without motion sensors.
const UPRIGHT: Tilt = { alpha: 0, beta: 90, gamma: 0 };
const RAD = Math.PI / 180;

// The phone's pose as column-major matrices in beluga's world: y up, and -z where alpha is 0. The
// camera sits `heightM` above a floor at y = 0 and never moves. `screenAngleDeg` is how far the
// page is turned from the phone's natural portrait (screen.orientation.angle).
export function poseFromTilt(
  tilt: Tilt,
  screenAngleDeg: number,
  heightM: number,
): { worldFromView: Float32Array; viewFromWorld: Float32Array } {
  const cX = Math.cos(tilt.beta * RAD);
  const sX = Math.sin(tilt.beta * RAD);
  const cY = Math.cos(tilt.gamma * RAD);
  const sY = Math.sin(tilt.gamma * RAD);
  const cZ = Math.cos(tilt.alpha * RAD);
  const sZ = Math.sin(tilt.alpha * RAD);
  // The phone's axes in earth terms (east, north, up): the columns of the spec's rotation matrix.
  const dx = [cZ * cY - sZ * sX * sY, cY * sZ + cZ * sX * sY, -cX * sY];
  const dy = [-cX * sZ, cZ * cX, sX];
  const dz = [cY * sZ * sX + cZ * sY, sZ * sY - cZ * cY * sX, cX * cY];
  // The screen's right and up on a turned page. The camera looks out the back, along -z.
  const ct = Math.cos(screenAngleDeg * RAD);
  const st = Math.sin(screenAngleDeg * RAD);
  const vx = dx.map((v, i) => ct * v - st * dy[i]);
  const vy = dx.map((v, i) => st * v + ct * dy[i]);
  // Earth to world: x east, y up, z south.
  const world = (e: number[]) => [e[0], e[2], -e[1]];
  const X = world(vx);
  const Y = world(vy);
  const Z = world(dz);
  const worldFromView = Float32Array.of(X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, 0, heightM, 0, 1);
  // A rotation's inverse is its transpose; the move back is the camera height along each axis.
  const viewFromWorld = Float32Array.of(
    X[0], Y[0], Z[0], 0,
    X[1], Y[1], Z[1], 0,
    X[2], Y[2], Z[2], 0,
    -X[1] * heightM, -Y[1] * heightM, -Z[1] * heightM, 1,
  );
  return { worldFromView, viewFromWorld };
}

// What the camera sees, from the picture's shape: the long side spans CAMERA_MODE.longSideFovDeg.
export function cameraFov(width: number, height: number): FieldOfView {
  const long = CAMERA_MODE.longSideFovDeg;
  const short = (2 * Math.atan(Math.tan((long * RAD) / 2) * (Math.min(width, height) / Math.max(width, height)))) / RAD;
  return width >= height ? { horizontal: long, vertical: short } : { horizontal: short, vertical: long };
}

function screenAngle(): number {
  const angle = typeof screen !== "undefined" ? screen.orientation?.angle : undefined;
  if (typeof angle === "number") return angle;
  // Older iOS: window.orientation, where -90 means 270.
  const legacy = (window as { orientation?: number }).orientation;
  return typeof legacy === "number" ? (legacy + 360) % 360 : 0;
}

// iOS asks for the motion sensors, and only from a tap. Other browsers just send the events.
function askMotion(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === "undefined") return Promise.resolve(false);
  const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
  if (typeof ask !== "function") return Promise.resolve(true);
  return ask.call(DeviceOrientationEvent).then(
    (state) => state === "granted",
    () => false,
  );
}

function errorText(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

// Call straight from the start tap: iOS needs the tap for the motion sensors, and asking first
// keeps it. The camera prompt follows.
export function startCameraSensing(options: CameraSensingOptions): SensingSession {
  const motionAsked = askMotion();
  // iOS plays a video later only if play() was first called in a tap. The element has no picture
  // yet, so this play() fails; what counts is that the tap started it.
  options.video.muted = true;
  options.video.playsInline = true;
  void options.video.play().catch(() => {});
  const media = navigator.mediaDevices?.getUserMedia
    ? navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: CAMERA_MODE.idealWidth },
          height: { ideal: CAMERA_MODE.idealHeight },
        },
        audio: false,
      })
    : Promise.reject(new Error("This browser can't use the camera"));
  const camera = media.catch((err: unknown) => {
    if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      throw new CameraDeniedError();
    }
    throw err;
  });

  const { video, onUpdate, onEnd } = options;
  const heightM = options.userHeightM * CAMERA_MODE.chestShare;
  const detectorSinks = new Set<DetectorSink>();
  const setup: SessionSetup = { name: "camera mode", refused: [] };
  const live: LiveStats = {
    frameRate: 0,
    updateRate: 0,
    processingMs: 0,
    depthError: null,
    cameraError: null,
    depthFrozen: false,
  };
  const frameCanvas = document.createElement("canvas");
  const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });

  let tilt: Tilt | null = null;
  let stream: MediaStream | null = null;
  let timers: number[] = [];
  let granted: Granted | null = null;
  let endReason: EndReason | null = null;
  let endError: string | null = null;
  let over = false;
  let started = false;
  let startedAt = performance.now();
  let updates = 0;
  let windowStart = startedAt;
  let windowUpdates = 0;
  let lastFov: FieldOfView | null = null;
  let forward: Flat = { x: 0, z: -1 };

  const onTilt = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    tilt = { alpha: event.alpha ?? 0, beta: event.beta, gamma: event.gamma };
  };
  const onHidden = () => {
    if (document.visibilityState === "hidden") end("hidden");
  };
  // After a refused play(): the next tap anywhere starts the camera. Touch taps count on their
  // end, so these two events and not pointerdown.
  const onTap = () => {
    video.play().then(() => {
      document.removeEventListener("click", onTap, true);
      document.removeEventListener("touchend", onTap, true);
      live.cameraError = null;
    }, () => {});
  };
  window.addEventListener("deviceorientation", onTilt);

  function summary(): SessionSummary {
    const durationS = (performance.now() - startedAt) / 1000;
    const rate = durationS > 0 ? updates / durationS : 0;
    return {
      reason: endReason ?? "ended",
      error: endError,
      setup: setup.name,
      durationS,
      granted,
      frameRate: rate,
      updateRate: rate,
      trackingLostShare: 0,
      depthValidShare: null,
      fov: lastFov,
      floor: { source: "guess", calibratedAfterS: null, driftM: null, phoneAboveFloorM: heightM },
    };
  }

  function cleanUp() {
    over = true;
    for (const id of timers) window.clearInterval(id);
    timers = [];
    window.removeEventListener("deviceorientation", onTilt);
    document.removeEventListener("visibilitychange", onHidden);
    document.removeEventListener("click", onTap, true);
    document.removeEventListener("touchend", onTap, true);
    for (const track of stream?.getTracks() ?? []) track.stop();
    video.srcObject = null;
    detectorSinks.clear();
  }

  function end(reason: EndReason, error?: string) {
    if (endReason) return;
    endReason = reason;
    endError = error ?? null;
    if (!started) return;
    cleanUp();
    onEnd(summary());
  }

  // Draws the current video picture at most `longEdge` pixels long.
  function draw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, longEdge: number) {
    const size = fitLongEdge(video.videoWidth, video.videoHeight, longEdge);
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    context.drawImage(video, 0, 0, size.width, size.height);
    return size;
  }

  function update() {
    const now = performance.now();
    if (!video.videoWidth || !video.videoHeight) return;
    const fov = cameraFov(video.videoWidth, video.videoHeight);
    lastFov = fov;
    const { worldFromView, viewFromWorld } = poseFromTilt(tilt ?? UPRIGHT, screenAngle(), heightM);
    // The walking direction is where the camera points, flat on the floor. Pointed at the floor
    // or the sky, the last one holds.
    const flat = Math.hypot(worldFromView[8], worldFromView[10]);
    if (flat >= SENSING.forwardMinFlat) forward = { x: -worldFromView[8] / flat, z: -worldFromView[10] / flat };
    updates++;
    windowUpdates++;
    if (now - windowStart >= 1000) {
      live.updateRate = (windowUpdates * 1000) / (now - windowStart);
      live.frameRate = live.updateRate;
      windowStart = now;
      windowUpdates = 0;
    }
    onUpdate({
      t: now - startedAt,
      tracking: true,
      points: NO_DEPTH.points,
      sampleCount: 0,
      validCount: 0,
      camera: { x: 0, y: heightM, z: 0 },
      worldFromView,
      viewFromWorld,
      projection: perspectiveFor(fov.horizontal, fov.vertical),
      fov,
      floorY: 0,
      floorSource: "guess",
      calibrating: false,
      forward,
      right: { x: -forward.z, z: forward.x },
      // Unknown without position tracking; the sounds treat the walker as moving.
      speed: 0,
      stationary: false,
    });
    live.processingMs = performance.now() - now;
  }

  function detectorFrame() {
    // A paused video holds one old picture: nothing new to look at.
    if (detectorSinks.size === 0 || !frameContext || !video.videoWidth || video.paused) return;
    try {
      const size = draw(frameCanvas, frameContext, Math.max(DETECTOR.inputWidth, DETECTOR.inputHeight));
      const { data } = frameContext.getImageData(0, 0, size.width, size.height);
      const t = performance.now() - startedAt;
      for (const sink of detectorSinks) sink({ ...size, data }, t);
      live.cameraError = null;
    } catch (err) {
      // A camera failure costs the detector its frames, never the rest of the walk.
      live.cameraError = errorText(err);
    }
  }

  const ready: Promise<Granted> = Promise.all([camera, motionAsked]).then(async ([s, motion]) => {
    stream = s;
    if (endReason) {
      cleanUp();
      throw new Error("Stopped before the camera started");
    }
    if (!motion) setup.refused.push("motion sensors: not allowed, so the phone is taken as upright");
    video.srcObject = s;
    try {
      await video.play();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "NotAllowedError")) throw err;
      // iOS can refuse to play outside a tap (in Low Power Mode, for one).
      live.cameraError = "waiting for a tap to start the camera";
      document.addEventListener("click", onTap, true);
      document.addEventListener("touchend", onTap, true);
      options.onCue?.("tap_camera");
    }
    for (const track of s.getVideoTracks()) track.addEventListener("ended", () => end("ended"));
    document.addEventListener("visibilitychange", onHidden);
    granted = { depth: false, camera: true, hitTest: false, domOverlay: true, localFloor: false };
    started = true;
    startedAt = performance.now();
    windowStart = startedAt;
    timers = [
      window.setInterval(update, 1000 / SENSING.updatesPerSecond),
      window.setInterval(detectorFrame, 1000 / DETECTOR.ratePerSecond),
    ];
    return granted;
  });
  // A refused camera ends nothing that started; the caller hears it through `ready`.
  ready.catch(() => {
    if (!started) cleanUp();
  });

  return {
    ready,
    stop: () => end("stop"),
    captureFrame(longEdge = FRAMES.captureLongEdgePx, quality = FRAMES.captureJpegQuality) {
      if (over || !started || !video.videoWidth) return Promise.resolve(null);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return Promise.resolve(null);
      const size = draw(canvas, context, longEdge);
      return new Promise<CapturedFrame | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob ? { blob, ...size } : null), "image/jpeg", quality),
      );
    },
    onDetectorFrame(sink) {
      detectorSinks.add(sink);
      return () => detectorSinks.delete(sink);
    },
    stats: () => ({ ...live }),
    setup: () => setup,
  };
}
