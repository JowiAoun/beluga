// The phone's settings, kept in local storage. Everything has a safe default, so a private window
// or cleared storage still gives a working walk.

import { ONE_SOUNDS, type OneSound } from "@/lib/audio/sounds";
import { DEFAULT_VOICE, isVoiceKey, type VoiceKey } from "@/lib/audio/voices";
import { STATIONS, type StationId } from "@/lib/shared/stations";
import { USER } from "@/lib/shared/params";
import type { VibrationSettings } from "@/lib/haptics/engine";
import { cleanWarnFrom, cleanWarningsOff, defaultWarnFrom, type WarningId, type WarnFromM } from "./warnings";

export interface Settings extends VibrationSettings {
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
  // Every warning plays this one sound, with no words. Null plays a sound per kind of hazard.
  oneSound: OneSound | null;
  // Names like "pole, left" as a hazard comes near.
  spokenNames: boolean;
  // The kinds of warning turned off in Settings (see warnings.ts).
  warningsOff: WarningId[];
  // How far away each kind of hazard starts to warn, in metres, set with a slider each.
  warnFromM: WarnFromM;
  // The ElevenLabs voice that says the warning words and Ask's answers (lib/audio/voices.ts).
  voice: VoiceKey;
  // The depth heatmap over the camera view during a walk.
  heatmap: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  vibrationOn: true,
  vibrationStrength: "medium",
  heightM: USER.defaultHeightM,
  station: "street",
  reportedSound: true,
  aliveTick: false,
  volumeDb: 0,
  firstRunDone: false,
  cameraOnly: false,
  headsetAsk: true,
  yellowStrip: true,
  oneSound: null,
  spokenNames: true,
  warningsOff: [],
  warnFromM: defaultWarnFrom(),
  voice: DEFAULT_VOICE,
  heatmap: false,
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
    vibrationOn: typeof saved.vibrationOn === "boolean" ? saved.vibrationOn : DEFAULT_SETTINGS.vibrationOn,
    vibrationStrength: saved.vibrationStrength === "light" || saved.vibrationStrength === "strong"
      ? saved.vibrationStrength : "medium",
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
    oneSound: ONE_SOUNDS.find((sound) => sound === saved.oneSound) ?? null,
    spokenNames: typeof saved.spokenNames === "boolean" ? saved.spokenNames : DEFAULT_SETTINGS.spokenNames,
    warningsOff: cleanWarningsOff(saved.warningsOff),
    warnFromM: cleanWarnFrom(saved.warnFromM),
    voice: isVoiceKey(saved.voice) ? saved.voice : DEFAULT_VOICE,
    heatmap: saved.heatmap === true,
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
