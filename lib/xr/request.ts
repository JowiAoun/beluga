// Asks Chrome for the AR session, stepping down when a phone refuses the setup. Some phones (a
// OnePlus 13R, for one) say they can run AR, then reject a session with every optional feature
// ("NotSupportedError"). Each try drops a feature: camera access first, since depth gives the real
// warnings, then depth. What is left still warns: depth without labels, or camera-only mode on the
// AR pose. When every try is refused, the walk falls back to camera mode (lib/xr/cameraSession.ts).

export interface SessionLevel {
  name: string;
  depth: boolean;
  camera: boolean;
}

export const SESSION_LEVELS: readonly SessionLevel[] = [
  { name: "every feature", depth: true, camera: true },
  { name: "no camera access", depth: true, camera: false },
  { name: "no depth", depth: false, camera: true },
];

// Chrome on ARCore has no float32 depth, so asking for it alone would return none.
export function sessionInit(overlayRoot: Element, level = 0): XRSessionInit {
  const { depth, camera } = SESSION_LEVELS[level];
  const optionalFeatures = [
    ...(depth ? ["depth-sensing"] : []),
    ...(camera ? ["camera-access"] : []),
    "hit-test",
    "dom-overlay",
    "local-floor",
  ];
  return {
    requiredFeatures: [],
    optionalFeatures,
    ...(depth
      ? {
          depthSensing: {
            usagePreference: ["cpu-optimized"],
            dataFormatPreference: ["luminance-alpha", "unsigned-short"],
          },
        }
      : {}),
    domOverlay: { root: overlayRoot },
  };
}

// Every setup was refused: the walk should use camera mode.
export class ArUnavailableError extends Error {
  constructor(readonly refused: string[]) {
    super(`this phone refused every AR setup (${refused.join("; ")})`);
    this.name = "ArUnavailableError";
  }
}

export interface Requested {
  session: XRSession;
  level: number;
  // "no depth: NotSupportedError: ..." for each setup refused before this one.
  refused: string[];
}

function refusedSetup(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotSupportedError";
}

// The level that worked on this phone, kept per browser version so an update tries them all again.
const LEVEL_KEY = "beluga.xrLevel";

interface SavedLevel {
  level: number;
  browser: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// SESSION_LEVELS.length means every AR setup was refused.
export function savedLevel(): number {
  try {
    const saved = JSON.parse(storage()?.getItem(LEVEL_KEY) ?? "null") as SavedLevel | null;
    if (!saved || saved.browser !== navigator.userAgent) return 0;
    return Math.min(Math.max(0, Math.floor(saved.level)), SESSION_LEVELS.length);
  } catch {
    return 0;
  }
}

export function saveLevel(level: number): void {
  try {
    storage()?.setItem(LEVEL_KEY, JSON.stringify({ level, browser: navigator.userAgent } satisfies SavedLevel));
  } catch {
    // Private mode: the steps run again next time.
  }
}

export function forgetLevel(): void {
  try {
    storage()?.removeItem(LEVEL_KEY);
  } catch {
    // Nothing kept.
  }
}

// Call straight from the tap: the first requestSession runs before anything is awaited. Chrome keeps
// the tap's activation for a few seconds, which covers the retries. A refusal moves the saved level
// on before the next try, so if the tap runs out, the next tap starts from there.
// `from` is the first level to try: the one that worked here before, unless given.
export async function requestArSession(xr: XRSystem, overlayRoot: Element, from = savedLevel()): Promise<Requested> {
  const refused: string[] = [];
  for (let level = from; level < SESSION_LEVELS.length; level++) {
    try {
      const session = await xr.requestSession("immersive-ar", sessionInit(overlayRoot, level));
      saveLevel(level);
      return { session, level, refused };
    } catch (err) {
      if (!refusedSetup(err)) throw err;
      refused.push(`${SESSION_LEVELS[level].name}: ${err instanceof Error ? err.message : String(err)}`);
      saveLevel(level + 1);
    }
  }
  throw new ArUnavailableError(refused);
}
