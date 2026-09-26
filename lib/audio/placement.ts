// Where a sound sits between the ears, for bone-conduction earbuds. There is no HRTF: the
// earbuds skip the outer ear, and the skull carries each side to both ears. The side comes from
// a large level difference plus a small time difference, which is what survives that.

import { AUDIO } from "@/lib/shared/params";

// -1 is the left ear only, 0 both ears the same, 1 the right ear only.
export type Pan = number;

export type Side = "left" | "ahead" | "right";

export interface EarSettings {
  farEarCutDb: number;
  maxEarDelayMs: number;
}

export const DEFAULT_EARS: EarSettings = { farEarCutDb: AUDIO.farEarCutDb, maxEarDelayMs: AUDIO.maxEarDelayMs };

function clampPan(pan: number): Pan {
  return Math.max(-1, Math.min(1, pan));
}

// Metres to the side of the walking line, negative to the left.
export function lateralOf(hazard: { distance: number; angle: number }): number {
  return hazard.distance * Math.tan((hazard.angle * Math.PI) / 180);
}

// Hazards pan by how far they sit to the side of the walking line, not by angle. A pole 0.3 m
// left sounds on the left from 3 m away, when its angle is only 6°, so there is time to step around.
export function panForLateral(lateralM: number): Pan {
  return clampPan(lateralM / AUDIO.fullPanLateralM);
}

// For sounds with only an angle, like an Ask answer about a box in the camera frame.
export function panForAngle(angleDeg: number): Pan {
  return clampPan(angleDeg / AUDIO.fullPanAngleDeg);
}

export function sideOf(lateralM: number): Side {
  if (Math.abs(lateralM) < AUDIO.centreLateralM) return "ahead";
  return lateralM < 0 ? "left" : "right";
}

// Gain for each ear. The near ear stays at full level; the far ear drops with the pan and goes
// silent at full pan, so a hard left sound comes from one transducer only.
export function earGains(pan: Pan, ears: EarSettings = DEFAULT_EARS): { left: number; right: number } {
  const amount = Math.abs(clampPan(pan));
  const far = amount >= 1 ? 0 : 10 ** ((-ears.farEarCutDb * amount) / 20);
  return pan < 0 ? { left: 1, right: far } : { left: far, right: 1 };
}

// Delay in seconds for each ear: the far ear hears the sound a little later.
export function earDelays(pan: Pan, ears: EarSettings = DEFAULT_EARS): { left: number; right: number } {
  const lag = (Math.abs(clampPan(pan)) * ears.maxEarDelayMs) / 1000;
  return pan < 0 ? { left: 0, right: lag } : { left: lag, right: 0 };
}

export interface Placer {
  // Connect mono sources here.
  input: GainNode;
  setPan(pan: Pan, at?: number): void;
  disconnect(): void;
}

// Movement between pans is smoothed over this time constant, in seconds.
const MOVE_SECONDS = 0.03;

// A mono input split to two ears, each with its own gain and delay, into a stereo output.
export function createPlacer(
  ctx: BaseAudioContext,
  destination: AudioNode,
  pan: Pan = 0,
  ears: EarSettings = DEFAULT_EARS,
): Placer {
  const input = new GainNode(ctx);
  const maxDelay = Math.max(0.001, ears.maxEarDelayMs / 1000);
  const gains = { left: new GainNode(ctx), right: new GainNode(ctx) };
  const delays = {
    left: new DelayNode(ctx, { maxDelayTime: maxDelay }),
    right: new DelayNode(ctx, { maxDelayTime: maxDelay }),
  };
  const merger = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
  input.connect(gains.left).connect(delays.left).connect(merger, 0, 0);
  input.connect(gains.right).connect(delays.right).connect(merger, 0, 1);
  merger.connect(destination);

  const place = (next: Pan, at: number | undefined, smooth: boolean) => {
    const g = earGains(next, ears);
    const d = earDelays(next, ears);
    const when = at ?? ctx.currentTime;
    for (const ear of ["left", "right"] as const) {
      if (smooth) {
        gains[ear].gain.setTargetAtTime(g[ear], when, MOVE_SECONDS);
        delays[ear].delayTime.setTargetAtTime(d[ear], when, MOVE_SECONDS);
      } else {
        gains[ear].gain.setValueAtTime(g[ear], when);
        delays[ear].delayTime.setValueAtTime(d[ear], when);
      }
    }
  };
  place(pan, undefined, false);

  return {
    input,
    setPan: (next, at) => place(next, at, true),
    disconnect: () => {
      input.disconnect();
      merger.disconnect();
    },
  };
}
