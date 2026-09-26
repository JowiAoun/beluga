// The phone's settings, kept in local storage. Everything has a safe default, so a private window
// or cleared storage still gives a working walk.

import { STATIONS, type StationId } from "@/lib/shared/stations";
import { USER } from "@/lib/shared/params";

export interface Settings {
  // Sets the head-height top: height + 0.1 m. Changed in 5 cm steps.
  heightM: number;
  // Where events go when there is no good location fix (underground, indoors).
  station: StationId | "street";
  reportedSound: boolean;
  // A soft tick every 30 s when nothing else has played, so the user knows beluga is running.
  aliveTick: boolean;
  // Master volume in dB, 0 is the level the sounds were made at.
  volumeDb: number;
  firstRunDone: boolean;
  // Hazards from the detector's boxes alone, for a phone without depth (Phase 10). Turns on by
  // itself when a walk starts without depth.
  cameraOnly: boolean;
  // The earbuds' play/pause button asks too (Phase 9 stretch).
  headsetAsk: boolean;
  // A wide safety-yellow band low in the camera view warns like an edge (Phase 10 stretch).
  yellowStrip: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  heightM: USER.defaultHeightM,
  station: "street",
  reportedSound: true,
  aliveTick: false,
  volumeDb: 0,
  firstRunDone: false,
  cameraOnly: false,
  headsetAsk: true,
  yellowStrip: true,
};

export const HEIGHT_RANGE_M = { min: 1.2, max: 2.1 } as const;
export const VOLUME_RANGE_DB = { min: -12, max: 6 } as const;

const KEY = "beluga.settings";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Stored values are checked one by one, so one bad field doesn't reset the rest.
export function readSettings(): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>) ?? {};
  } catch {
    saved = {};
  }
  const stations = new Set<string>(STATIONS.map((s) => s.id));
  return {
    heightM:
      typeof saved.heightM === "number"
        ? clamp(Math.round(saved.heightM / USER.heightStepM) * USER.heightStepM, HEIGHT_RANGE_M.min, HEIGHT_RANGE_M.max)
        : DEFAULT_SETTINGS.heightM,
    station: typeof saved.station === "string" && stations.has(saved.station) ? (saved.station as StationId) : "street",
    reportedSound: typeof saved.reportedSound === "boolean" ? saved.reportedSound : DEFAULT_SETTINGS.reportedSound,
    aliveTick: typeof saved.aliveTick === "boolean" ? saved.aliveTick : DEFAULT_SETTINGS.aliveTick,
    volumeDb:
      typeof saved.volumeDb === "number"
        ? clamp(saved.volumeDb, VOLUME_RANGE_DB.min, VOLUME_RANGE_DB.max)
        : DEFAULT_SETTINGS.volumeDb,
    firstRunDone: saved.firstRunDone === true,
    cameraOnly: saved.cameraOnly === true,
    headsetAsk: typeof saved.headsetAsk === "boolean" ? saved.headsetAsk : DEFAULT_SETTINGS.headsetAsk,
    yellowStrip: typeof saved.yellowStrip === "boolean" ? saved.yellowStrip : DEFAULT_SETTINGS.yellowStrip,
  };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode: the settings last for this visit.
  }
}

// "1.85 m", as it is shown and spoken.
export function heightText(heightM: number): string {
  return `${heightM.toFixed(2)} metres`;
}

export function stepHeight(heightM: number, steps: number): number {
  const next = Math.round((heightM + steps * USER.heightStepM) * 100) / 100;
  return clamp(next, HEIGHT_RANGE_M.min, HEIGHT_RANGE_M.max);
}
