import type { Report } from "./checks";

const SWEEP = [
  { name: "left", angle: -90 },
  { name: "centre", angle: 0 },
  { name: "right", angle: 90 },
] as const;

const STEP_SECONDS = 0.8;

// Must run inside the start tap, or Chrome keeps the context suspended.
export function startAudio(): AudioContext {
  const ctx = new AudioContext({ latencyHint: "interactive" });
  void ctx.resume();
  return ctx;
}

// One tone hard left, one ahead, one hard right, each through an HRTF panner 1.5 m away.
// A filtered sawtooth has enough high end for HRTF to place it; a pure sine barely moves.
// Returns how long the sweep lasts, in milliseconds.
export function playSweep(ctx: AudioContext): number {
  const start = ctx.currentTime + 0.05;
  SWEEP.forEach((step, i) => {
    const t = start + i * STEP_SECONDS;
    const rad = (step.angle * Math.PI) / 180;
    const panner = new PannerNode(ctx, {
      panningModel: "HRTF",
      distanceModel: "linear",
      rolloffFactor: 0,
      positionX: Math.sin(rad) * 1.5,
      positionY: 0,
      positionZ: -Math.cos(rad) * 1.5,
    });
    const osc = new OscillatorNode(ctx, { type: "sawtooth", frequency: 330 });
    const filter = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 3000 });
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(filter).connect(gain).connect(panner).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
  return (0.05 + SWEEP.length * STEP_SECONDS) * 1000;
}

// Chrome's own latency estimate. Bluetooth is often under-reported, so the plan's
// video check (film the tap and listen) stays the real number.
export function describeLatency(ctx: AudioContext): string {
  const output = Math.round((ctx.outputLatency ?? 0) * 1000);
  const base = Math.round(ctx.baseLatency * 1000);
  return `Chrome reports ${output} ms output latency (${base} ms base)`;
}

export async function requestWakeLock(report: Report): Promise<WakeLockSentinel | null> {
  if (!("wakeLock" in navigator)) {
    report("wakeLock", "fail", "navigator.wakeLock is missing");
    return null;
  }
  try {
    const lock = await navigator.wakeLock.request("screen");
    report("wakeLock", "pass", "screen wake lock held");
    return lock;
  } catch (err) {
    report("wakeLock", "fail", errorText(err));
    return null;
  }
}

// Watches position and reports accuracy. The plan treats worse than 100 m as no good fix.
export function watchLocation(report: Report): () => void {
  if (!("geolocation" in navigator)) {
    report("location", "fail", "navigator.geolocation is missing");
    return () => {};
  }
  const started = performance.now();
  let firstFixMs: number | null = null;
  let best = Infinity;
  report("location", "running", "waiting for a fix");

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      firstFixMs ??= performance.now() - started;
      best = Math.min(best, pos.coords.accuracy);
      const where = `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
      report(
        "location",
        best <= 100 ? "pass" : "warn",
        `±${Math.round(pos.coords.accuracy)} m now, best ±${Math.round(best)} m, ` +
          `first fix after ${(firstFixMs / 1000).toFixed(1)} s, near ${where}`,
      );
    },
    (err) => {
      // A timeout after a good fix only means no new position; keep the fix.
      if (firstFixMs === null) report("location", "fail", `${err.message} (code ${err.code})`);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Chrome on Android sends compass headings as "deviceorientationabsolute". The device check runs
// this twice: from page load, and again once the AR session runs, to see if Chrome pauses them in AR.
export function watchCompass(report: Report, id: "compass" | "compassInAr"): () => void {
  let seen = false;
  let lastReport = 0;
  const onEvent = (event: Event) => {
    const e = event as DeviceOrientationEvent;
    if (e.alpha === null) return;
    seen = true;
    const now = performance.now();
    if (now - lastReport < 250) return;
    lastReport = now;
    const heading = Math.round((360 - e.alpha) % 360);
    report(id, "pass", `heading ${heading}° from north`);
  };
  report(id, "running", "waiting for orientation events");
  window.addEventListener("deviceorientationabsolute", onEvent);
  const timer = window.setTimeout(() => {
    if (!seen) report(id, "fail", "no absolute orientation events after 5 s");
  }, 5000);
  return () => {
    window.removeEventListener("deviceorientationabsolute", onEvent);
    window.clearTimeout(timer);
  };
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
