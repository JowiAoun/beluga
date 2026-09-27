// Every tunable number from "Tunable parameters" in docs/PLAN.md, plus the few numbers the
// phases name outside that table. Tune here, on the phone, never inline in other modules.

import type { DetectorClass, HazardKind, Severity } from "./enums";

export const SENSING = {
  updatesPerSecond: 10,
  depthGrid: { cols: 48, rows: 36 },
  depthMinM: 0.2,
  depthMaxM: 5.0,

  corridorHalfWidthM: 0.45,
  corridorAheadMinM: 0.3,
  corridorAheadMaxM: 3.0,
  dropOffAheadMaxM: 3.5,

  // Heights are above the fitted floor line. A single step or curb is 15 to 18 cm, so anything
  // more than 15 cm below the floor counts as a drop-off.
  floorBandM: { low: -0.15, high: 0.15 },
  obstacleBandM: { low: 0.15, high: 1.4 },
  headHeightBottomM: 1.4,
  dropOffBelowFloorM: 0.15,
  floorSlopeClamp: 0.1,

  lateralBuckets: 5,
  minPointsPerHit: 6,
  bucketMergeDistanceM: 0.3,
  poleLikeMinHeightSpanM: 1.0,

  activateAfterUpdates: 3,
  deactivateAfterUpdates: 6,
  smoothingWeight: 0.5,
  outOfViewMemoryMaxMs: 3000,

  nearMissDistanceM: 1.0,
  // A hazard covering the whole corridor (a wall, a closed door) never counts as a near-miss.
  nearMissMaxBlocking: 0.9,

  // Floor and walking direction (Phase 1).
  localFloorGuessM: 1.2,
  floorCalibrationLowestShare: 0.2,
  floorCalibrationAheadM: { min: 0.5, max: 2.0 },
  floorReestimateMs: 5000,
  floorReestimateBandM: 0.1,
  walkingDirectionSmoothingMs: 500,
  travelBlendMinSpeedMps: 0.3,
  travelBlendWeight: 0.5,
  travelDirectionWindowMs: 1000,
  stationaryMaxMoveM: 0.1,
  stationaryWindowMs: 5000,
  trackingLostMs: 1000,
  holdSteadyCooldownMs: 10_000,

  // First floor value: a hit test on a ray from the phone, this far below straight ahead.
  floorHitRayDownDeg: 45,
  // Up component of the hit surface's normal. A floor is close to 1, a wall close to 0.
  floorHitMinUp: 0.9,
  floorHitBelowCameraM: { min: 0.5, max: 2.0 },
  floorHitSamples: 5,
  // Floor candidates must sit at least this far below the phone, so a table top never counts.
  floorMinBelowCameraM: 0.3,
  // Calibration ends after three slow steps (this much walking) or this long, once it has enough points.
  calibrationMoveM: 1.5,
  calibrationMaxMs: 8000,
  calibrationMinPoints: 200,
  floorReestimateWeight: 0.3,
  floorReestimateMinPoints: 50,
  // Under this, the camera points nearly straight up or down, and its flattened forward is noise.
  forwardMinFlat: 0.2,

  // The sloped floor line needs this many floor points in the corridor, else the floor counts as flat.
  floorLineMinPoints: 20,
  // Near points must spread this far ahead for the line to have a slope.
  floorLineMinSpreadM: 0.3,
  // An obstacle covering at least this share of the corridor gets the "blocked" priority (3).
  blockedMinBlocking: 0.6,
  // A hazard no longer seen stops once it sits this far outside the corridor: the user turned
  // away from it or stepped around it.
  forgetOutsideCorridorM: 0.25,

  // Trusting depth (lib/xr/depth.ts). Each grid cell reads five depth pixels this far from its
  // centre (a share of the cell), and keeps a depth only when at least 3 of them agree to within
  // 8 cm or 6% of the depth, whichever is more.
  depthReadSpread: 0.3,
  depthAgreeMin: 3,
  depthAgreeM: 0.08,
  depthAgreeShare: 0.06,
  // A hazard only follows a new reading this close to where it was, so noise across the view
  // can't pull its distance around.
  trackMatchMaxM: 0.6,
  // A drop-off needs this many floor points before its edge in the same lane, and to be seen in
  // this many updates, with one miss allowed between them, before it sounds.
  dropOffMinFloorPoints: 6,
  dropOffActivateAfterUpdates: 5,
  // After calibration the floor moves to where the phone's height says it is (after stairs, an
  // escalator, or ARCore shifting its world) once depth shows it there, and not at the old
  // height, for this many updates in a row with at least this many floor points.
  floorMoveAfterUpdates: 3,
  floorMoveMinPoints: 30,
  // Chrome hands back the last depth image when ARCore sends no new one. Depth that hasn't changed
  // for this long while the phone moved 5 cm or turned 3° is stale, and placed with the new pose
  // it would put things in the wrong spot, so it counts as no depth.
  depthFrozenAfterMs: 500,
  depthFrozenMoveM: 0.05,
  depthFrozenTurnDeg: 3,
} as const;

export const USER = {
  defaultHeightM: 1.85,
  heightStepM: 0.05,
  // Door frames sit at 2.03 m, so the top follows the user and not a fixed 2.2 m.
  headHeightAboveUserM: 0.1,
} as const;

export function headHeightTopM(userHeightM: number = USER.defaultHeightM): number {
  return userHeightM + USER.headHeightAboveUserM;
}

// Repeat interval and volume by distance ahead, nearest band first. Past the last band: silent.
// Only the last metre sounds: further out a thing is still a few steps away, and fewer sounds
// keep each one clear. Hazards are still found out to 3 m, so they sound the moment they come in.
export const AUDIO_BANDS = [
  { upToM: 0.3, repeatMs: 80, gainDb: 0 },
  { upToM: 0.5, repeatMs: 120, gainDb: 0 },
  { upToM: 0.75, repeatMs: 220, gainDb: -3 },
  { upToM: 1.0, repeatMs: 350, gainDb: -6 },
] as const;

export type AudioBand = (typeof AUDIO_BANDS)[number];

// Drop-offs use the same table 0.5 m further out: they start at 1.5 m and go continuous under 0.8 m,
// since stopping before a step down takes longer than stepping around a pole.
export const DROP_OFF_BAND_SHIFT_M = 0.5;

export function audioBandFor(distanceM: number, kind: HazardKind): AudioBand | null {
  const shift = kind === "drop_off" ? DROP_OFF_BAND_SHIFT_M : 0;
  for (const band of AUDIO_BANDS) {
    if (distanceM <= band.upToM + shift) return band;
  }
  return null;
}

export const AUDIO = {
  // Bone-conduction earbuds skip the outer ear, so HRTF cues are lost, and the skull carries each
  // side to both ears. A sound's side is a level and time difference between the ears instead.
  // A hazard this far to the side of the walking line plays from one ear only.
  fullPanLateralM: 0.45,
  // Sounds placed by angle (Ask answers) play from one ear only at this angle.
  fullPanAngleDeg: 20,
  // Within this of the walking line, a hazard is straight ahead and gets the centre marker.
  centreLateralM: 0.09,
  // The far ear drops by this × pan (0 to 1), and goes silent at full pan.
  farEarCutDb: 24,
  // The far ear also hears it later, by this × pan.
  maxEarDelayMs: 0.6,
  // Hazards sounding at once. One at a time keeps each side clear; the nearest band wins.
  maxHazardVoices: 1,
  lowerPriorityDuckDb: -12,
  askDuckDb: -12,
  stationaryAfterMs: 5000,
  stationaryReductionDb: -6,
  stationaryStopAfterRepeats: 3,
  voiceClipBandM: { from: 0.5, to: 1.0 },
  voiceClipCooldownMs: 8000,
  schedulerTickMs: 25,
  // A new repeat cuts the one still playing with this fade.
  cutFadeMs: 10,
  aliveTickMs: 30_000,
  effectPeakDbfs: -3,
  voiceLufs: -16,
  // Repeats are placed on the audio clock this far ahead of each scheduler tick.
  scheduleAheadMs: 100,
  // Bluetooth plays a sound this late, so bands use the distance the user will be at by then:
  // distance - speed × output latency, with the latency capped here.
  latencyLeadMaxMs: 400,
  // Android and the earbuds go idle after a few seconds of silence and clip the start of the next
  // sound. A steady noise this quiet keeps them awake without being heard.
  keepAliveDbfs: -70,
  // A limiter on the mix keeps two hazards plus a voice from clipping, which buzzes on bone conduction.
  limiterThresholdDb: -3,
  // Bone conduction plays little below this and buzzes when pushed, so sound files are cut below it.
  highPassHz: 250,
  // Voice clips add "left", "right" or "ahead", since side cues are weak on bone conduction.
  voiceClipSaysSide: true,
  // The centre marker plays with the first repeat straight ahead, then at most this often.
  centreMarkerEveryMs: 1000,
} as const;

export const DETECTOR = {
  inputWidth: 320,
  inputHeight: 240,
  ratePerSecond: 4,
  hotRatePerSecond: 2,
  scoreThreshold: 0.35,
  maxResults: 10,
  labelMatchWindowDeg: 10,
  labelHoldMs: 1000,
  // Label matching: an obstacle's box must reach into the lower two-thirds of the frame, and a
  // head-height box must start in the upper half. 0 is the top of the frame, 1 the bottom.
  obstacleBoxBottomMin: 1 / 3,
  headBoxTopMax: 0.5,
  // A frame out for detection this long never came back: the detector takes the next one.
  stallMs: 3000,
} as const;

export const GATE = {
  newThingActiveMs: 1000,
  newThingCooldownMs: 20_000,
  lastingCooldownMs: 30_000,
  dropOffCooldownMs: 30_000,
  headHeightCooldownMs: 30_000,
  headHeightTriggerM: 1.5,
  steerAroundAngleDeg: 15,
  steerAroundMaxDistanceM: 2,
  maxTurnRateDegPerS: 60,
  minBrightness: 25,
  phoneMinIntervalMs: 6000,
  phoneHourlyBudget: 150,
  // Over this share, a sidewalk obstruction or construction barrier switches to the "blocked" sound.
  blockedSoundMinBlocking: 0.6,
} as const;

export const FRAMES = {
  captureLongEdgePx: 768,
  captureJpegQuality: 0.7,
  maxFrameBytes: 400 * 1024,
  // A requested frame that doesn't arrive in this time resolves as no frame.
  captureWaitMs: 1000,
} as const;

export const NETWORK = {
  triageTimeoutMs: 6000,
  askTimeoutMs: 8000,
  // Defaults for TRIAGE_HOURLY_BUDGET and ASK_HOURLY_BUDGET.
  triageHourlyBudget: 150,
  askHourlyBudget: 120,
  eventBatchIntervalMs: 10_000,
  eventBatchMaxEvents: 50,
  eventBatchLimit: 200,
  eventMaxAgeDays: 7,
  eventMaxFutureMinutes: 5,
  reportDedupMs: 15 * 60 * 1000,
  stationSnapRadiusM: 150,
  locationMaxAccuracyM: 100,
  locationFixTimeoutMs: 30_000,
} as const;

export const CONTROLS = {
  stopLongPressMs: 600,
  minButtonHeightPx: 64,
} as const;

export const COARSENING = {
  decimals: 3,
  geohashLength: 7,
} as const;

export const REPORTING = {
  minConfidence: 0.7,
  minConfidenceOtherFixed: 0.85,
  descriptionMaxWords: 15,
  // Blocking share over which a sidewalk obstruction goes from 2 to 3.
  obstructionBlockingForSeverity3: 0.6,
  checkNowSeverity: 4,
} as const;

export const SEVERITY_WEIGHTS: Readonly<Record<Severity, number>> = { 1: 1, 2: 2, 3: 4, 4: 8 };

// Fix-first score parts (Phase 6). The view computes them in SQL; these are the same numbers.
export const FIX_FIRST = {
  windowDays: 14,
  kAnonymityReporters: 3,
  recentReportHours: 48,
  recentBoost: 1.5,
  recencyHalfLifeDays: 7,
  transitBoost: 1.3,
  transitRadiusM: 150,
} as const;

export const DATABASE = {
  chunkDays: 1,
  compressAfterDays: 7,
  deleteRawAfterDays: 180,
  clientMaxConnections: 2,
  // A database that can't be reached fails in this time, not postgres.js's default 30 s.
  clientConnectTimeoutS: 2,
  clientIdleTimeoutS: 20,
  freeServiceLimitMb: 750,
  // Checks Ask and triage wait on (the budget, the repeat-report check) give up after this.
  quickQueryMs: 1000,
} as const;

export const DASHBOARD = {
  feedAndQueuePollMs: 5000,
  cellsAndStationsPollMs: 15_000,
  queueLimit: 25,
  feedLimit: 20,
  // Ask the data (Phase 7 stretch): rows per lookup sent to the agent, how long a lookup may take,
  // the whole answer's time limit, and the default for DATA_HOURLY_BUDGET.
  askDataRows: 10,
  askDataLookupMs: 3000,
  askDataTimeoutMs: 15_000,
  askDataHourlyBudget: 60,
} as const;

export const SEED = {
  days: 14,
  minRows: 300_000,
  maxRows: 500_000,
} as const;

export const DEBUG_OVERLAY = {
  refreshMs: 250,
} as const;

export const HAPTICS = {
  pulseMs: { light: 35, medium: 70, strong: 120 },
  pulseGapMs: 100,
  calibrationPulseMs: 45,
  calibrationGapMs: 180,
  nearM: 0.5,
  farM: 3,
  dropOffFarM: 3.5,
  nearIntervalMs: 450,
  farIntervalMs: 1500,
  minimumRestMs: 200,
} as const;

export const VOICE_ASK = {
  recordingMaxMs: 10_000,
  recordingBitsPerSecond: 64_000,
  audioMaxBytes: 1024 * 1024,
  questionMaxChars: 200,
  transcriptionTimeoutMs: 15_000,
  requestOverheadBytes: 8192,
  clientTimeoutMs: 25_000,
  budgetWindowMs: 60 * 60 * 1000,
  maxConcurrent: 3,
} as const;

export const SOUND_CACHE = {
  name: "beluga-sounds-v1",
  fetchTimeoutMs: 8000,
} as const;

export const PRACTICE = {
  repeats: 3,
  repeatGapMs: 500,
} as const;

// Camera-only mode (Phase 10), for a phone that loses depth: hazards from detector boxes alone.
export const CAMERA_ONLY = {
  // A box whose bottom edge reaches this far down the frame (0 top, 1 bottom) is cut off.
  cutOffEdge: 0.97,
  // Detector results in a row before a thing starts sounding. They arrive about 4 times a second.
  activateAfterBoxes: 2,
  // A thing keeps its spot on the floor this long after its last box, then goes quiet.
  holdMs: 1000,
  // A new box joins a thing of the same class within this distance on the floor.
  matchDistanceM: 0.7,
} as const;

// Usual heights of what the detector names. When the frame cuts off a box's bottom, its top edge
// and this height place it instead. People as the plan has it; the rest are typical sizes.
export const CAMERA_ONLY_HEIGHTS_M: Readonly<Partial<Record<DetectorClass, number>>> = {
  person: 1.7,
  bicycle: 1.0,
  motorcycle: 1.1,
  car: 1.5,
  bus: 3.0,
  truck: 3.0,
  bench: 0.8,
  chair: 0.9,
  fire_hydrant: 0.7,
  stop_sign: 2.2,
  potted_plant: 0.8,
  suitcase: 0.7,
};

// Yellow edge strips (Phase 10 stretch): a wide safety-yellow band low in the camera frame.
export const TACTILE = {
  hueDeg: { min: 40, max: 70 },
  minSaturation: 0.45,
  minValue: 0.45,
  // Share of the frame's lower third that must be yellow.
  minShare: 0.08,
  // A row is part of the band when yellow covers this share of it.
  minRowShare: 0.3,
  // The band must reach across this share of the frame's width.
  minWidth: 0.5,
  framesInARow: 3,
  // Depth's own drop-off within this distance of the strip plays instead.
  depthCoversM: 0.75,
} as const;

// Camera mode: phones without WebXR AR, like an iPhone in Safari. No depth, no position tracking.
export const CAMERA_MODE = {
  // A phone's main camera sees about this wide across the long side of its picture.
  longSideFovDeg: 67,
  // The phone sits on the chest, at this share of the user's height above the floor.
  chestShare: 0.72,
  // Asked of getUserMedia; phones give what they have.
  idealWidth: 1280,
  idealHeight: 720,
} as const;

// The tilt banner on the walking screen (lib/xr/tilt.ts). Chest-high in portrait, with Chrome's
// 74° tall view, the phone sees the floor ahead and up to head height while the camera points
// between 25° down and 10° up. Past 10° up the floor only shows past about 2.6 m, so edges come
// late; past 25° down, little at head height shows; turned past 20°, the path slides out of view.
export const TILT = {
  upMaxDeg: 10,
  downMaxDeg: 25,
  sideMaxDeg: 20,
  // The banner goes once the phone is back inside the limits by this much.
  clearMarginDeg: 5,
  // Past the limits this long before the banner shows, so a sway never flashes it.
  showAfterMs: 1000,
} as const;
