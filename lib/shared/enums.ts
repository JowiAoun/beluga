// Enumerations from the "Shared data contracts" section of docs/PLAN.md.
// The phone, the backend and the dashboard all import these, so a value is spelled once.

export const HAZARD_KINDS = ["obstacle", "head_height", "drop_off"] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

export const DETECTOR_CLASSES = [
  "person",
  "bicycle",
  "motorcycle",
  "car",
  "bus",
  "truck",
  "bench",
  "chair",
  "fire_hydrant",
  "stop_sign",
  "potted_plant",
  "suitcase",
  "pole_like",
  "unknown",
] as const;
export type DetectorClass = (typeof DETECTOR_CLASSES)[number];

export const SOUND_IDS = [
  "edge_pulse",
  "head_chime",
  "tick",
  "ping",
  "bell",
  "marimba",
  "buzz",
  "taps",
  "listening",
  "ready",
  "reported",
  "centre_tick",
] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export const EVENT_KINDS = ["hazard_seen", "near_miss", "civic_report"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const CIVIC_CATEGORIES = [
  "sidewalk_obstruction",
  "construction_barrier",
  "head_height_hazard",
  "surface_damage",
  "blocked_curb_cut",
  "tactile_strip_issue",
  "snow_ice",
  "other_fixed",
] as const;
export type CivicCategory = (typeof CIVIC_CATEGORIES)[number];

export const SCENE_CONTEXTS = ["platform", "crosswalk", "sidewalk", "indoor", "stairs", "unknown"] as const;
export type SceneContext = (typeof SCENE_CONTEXTS)[number];

export const SOURCES = ["live", "simulated"] as const;
export type Source = (typeof SOURCES)[number];

// Path left to get past a thing: clear is 1.5 m or more (O. Reg. 191/11, s. 80.23), narrow is less.
export const WAY_AROUND = ["clear", "narrow", "none"] as const;
export type WayAround = (typeof WAY_AROUND)[number];

// 1 Minor, 2 Detour, 3 Collision, 4 Fall. See "Severity" in docs/PLAN.md.
export const SEVERITIES = [1, 2, 3, 4] as const;
export type Severity = (typeof SEVERITIES)[number];

// Dashboard filters (Phase 7).
export const DASHBOARD_WINDOWS = ["1h", "24h", "7d", "14d"] as const;
export type DashboardWindow = (typeof DASHBOARD_WINDOWS)[number];

export const SOURCE_FILTERS = ["live", "simulated", "both"] as const;
export type SourceFilter = (typeof SOURCE_FILTERS)[number];

// Bump this when the consent text changes. Events carry it, and intake rejects a batch without it.
export const CONSENT_VERSION = 1;
