export const CHECKS = [
  { id: "secure", label: "Secure page (HTTPS or localhost)" },
  { id: "installed", label: "Running as the installed app" },
  { id: "webgl2", label: "WebGL 2" },
  { id: "webxr", label: "WebXR with immersive-ar" },
  { id: "cameraMode", label: "Camera mode, for phones without AR" },
  { id: "session", label: "AR session starts" },
  { id: "setup", label: "AR features this phone accepts" },
  { id: "domOverlay", label: "DOM overlay" },
  { id: "floor", label: "local-floor reference space" },
  { id: "hitTest", label: "Hit test" },
  { id: "depth", label: "Depth data" },
  { id: "camera", label: "Camera image" },
  { id: "fov", label: "Field of view" },
  { id: "tracking", label: "Tracking and frame rate" },
  { id: "audio", label: "Sound: left, centre, right" },
  { id: "wakeLock", label: "Screen wake lock" },
  { id: "location", label: "Location" },
  { id: "compass", label: "Compass heading, before AR" },
  { id: "compassInAr", label: "Compass heading, inside AR" },
] as const;

export type CheckId = (typeof CHECKS)[number]["id"];

// info: nothing to pass or fail, the numbers are the result.
export type CheckStatus = "idle" | "running" | "pass" | "warn" | "fail" | "info";

export interface CheckResult {
  status: CheckStatus;
  detail: string;
}

export type CheckResults = Record<CheckId, CheckResult>;

export type Report = (id: CheckId, status: CheckStatus, detail: string) => void;

export function initialResults(): CheckResults {
  return Object.fromEntries(CHECKS.map((c) => [c.id, { status: "idle", detail: "" }])) as CheckResults;
}
