// What gets reported, and how bad it is. See "What gets reported" in docs/PLAN.md.
// Gemini only answers yes/no questions about what it sees. This code makes every decision,
// so the same answers always give the same severity, and the dashboard can say why.
// Triage, the seed generator and the dashboard all use this one file.

import type { CivicCategory, HazardKind, SceneContext, Severity, WayAround } from "./enums";
import { REPORTING } from "./params";

export type RuleId =
  | "clearWidth"
  | "headroomBarrier"
  | "protrudingObjects"
  | "tactileStairsCurbs"
  | "tactilePlatforms"
  | "scooterParking";

// "Where the numbers come from" in docs/PLAN.md.
export const RULES: Readonly<Record<RuleId, { rule: string; source: string }>> = {
  clearWidth: {
    rule: "Outdoor paths keep 1.5 m of clear width (1.2 m where a path meets a curb ramp)",
    source: "Ontario O. Reg. 191/11 (AODA), s. 80.23",
  },
  headroomBarrier: {
    rule: "Where headroom drops below 2.1 m, a rail or barrier a cane can find must go around the object",
    source: "O. Reg. 191/11, s. 80.23; City of Ottawa Accessibility Design Standards (ADS) 2.5.2",
  },
  protrudingObjects: {
    rule: "Anything sticking out more than 100 mm between 680 mm and 2030 mm must be cane-detectable at or below 680 mm",
    source: "CSA B651-12, 4.4.1; Ottawa ADS 2.5.1 and 2.5.3",
  },
  tactileStairsCurbs: {
    rule: "Tactile strips at the top of every flight of stairs, and at curb ramps and depressed curbs at crossings",
    source: "O. Reg. 191/11, s. 80.25 to 80.27",
  },
  tactilePlatforms: {
    rule: "Tactile strips along the full length of a transit platform edge",
    source: "CSA B651-12, 4.3.5.3.2; Ottawa ADS 6.20.1.3 (OC Transpo platforms)",
  },
  scooterParking: {
    rule: "Parked e-scooters leave 2 m of foot path clear",
    source: "City of Ottawa e-scooter rules, 2026 season",
  },
};

export const CHANNELS_311 = {
  scooter: "311 \"Misparked e-scooter\" form",
  phone: "Call 311 (there is no online form for broken sidewalks)",
  problemForm: "311 road, sidewalk or pathway problem form",
} as const;

export interface CategoryRule {
  covers: string;
  notThis: string | null;
  baseSeverity: Severity;
  goesUp: string | null;
  whoFixesIt: string;
  channel311: string;
  rules: readonly RuleId[];
}

// The "Categories" table in docs/PLAN.md, row for row.
export const CATEGORY_RULES: Readonly<Record<CivicCategory, CategoryRule>> = {
  sidewalk_obstruction: {
    covers: "E-scooter, bike, sandwich board, bin or furniture left in the path",
    notThis: "Cars in the road, people, things being carried",
    baseSeverity: 2,
    goesUp: "3 if there is no way around or it blocks over 60% of the path",
    whoFixesIt: "Scooter operator (e-scooters) or City by-law",
    channel311: `${CHANNELS_311.scooter} for e-scooters; ${CHANNELS_311.problemForm} for the rest`,
    rules: ["clearWidth", "scooterParking"],
  },
  construction_barrier: {
    covers: "Fencing, barriers, cones, a closed sidewalk",
    notThis: null,
    baseSeverity: 2,
    goesUp: "3 with no warning a cane can find (tape only, gaps between cones); 4 if there is also a trip or drop",
    whoFixesIt: "Permit holder, through the City",
    channel311: CHANNELS_311.problemForm,
    rules: ["protrudingObjects"],
  },
  head_height_hazard: {
    covers:
      "Sign, branch, awning, mirror or open window sticking out more than 10 cm between 0.68 m and 2.1 m high, with nothing at or below 0.68 m for a cane to hit",
    notThis: "Anything that reaches the ground: the cane finds it",
    baseSeverity: 3,
    goesUp: null,
    whoFixesIt: "Property owner, or City forestry for branches",
    channel311: CHANNELS_311.problemForm,
    rules: ["headroomBarrier", "protrudingObjects"],
  },
  surface_damage: {
    covers: "Hole, heaved or broken slab, broken curb in the path",
    notThis: "Cracks with no height change",
    baseSeverity: 2,
    goesUp: "3 if there is a trip or drop, or the phone measured a drop-off",
    whoFixesIt: "City roads and sidewalks",
    channel311: CHANNELS_311.phone,
    rules: [],
  },
  blocked_curb_cut: {
    covers: "Curb ramp blocked by a car, snow, a scooter or water",
    notThis: null,
    baseSeverity: 2,
    goesUp: "3 if there is no way around (the way on is through the road)",
    whoFixesIt: "City by-law or roads",
    channel311: CHANNELS_311.problemForm,
    rules: ["clearWidth"],
  },
  tactile_strip_issue: {
    covers:
      "Warning strip missing, worn, broken or covered where one is required: a transit platform edge, the top of stairs, a curb ramp or depressed curb at a crossing",
    notThis: "Intact strips; places where no strip is required",
    baseSeverity: 3,
    goesUp: "4 at a platform edge or the top of stairs",
    whoFixesIt: "OC Transpo within 150 m of a station; the City at curbs; the property owner indoors",
    channel311: CHANNELS_311.problemForm,
    rules: ["tactileStairsCurbs", "tactilePlatforms"],
  },
  snow_ice: {
    covers: "Snowbank or ice in the path, unplowed curb ramp",
    notThis: null,
    baseSeverity: 2,
    goesUp: "3 if there is no way around",
    whoFixesIt: "City winter maintenance",
    channel311: CHANNELS_311.problemForm,
    rules: ["clearWidth"],
  },
  other_fixed: {
    covers: "Anything fixed and in the way that fits nothing above",
    notThis: null,
    baseSeverity: 2,
    goesUp: null,
    whoFixesIt: "City 311",
    channel311: CHANNELS_311.problemForm,
    rules: [],
  },
};

// Gemini's yes/no answers about the frame.
export interface TriageAnswers {
  isPublic: boolean;
  leftOrFixed: boolean;
  wayAround: WayAround;
  caneWarning: boolean;
  tripOrDrop: boolean;
}

// What the phone measured with depth, which Gemini can't.
export interface Measured {
  // Share of the corridor width covered, 0 to 1.
  blocking: number;
  measuredDropOff: boolean;
  // A transit platform edge or the top of stairs.
  atPlatformOrStairs: boolean;
}

export function measuredFrom(hazard: { kind: HazardKind; blocking: number }, context: SceneContext | null): Measured {
  return {
    blocking: hazard.blocking,
    measuredDropOff: hazard.kind === "drop_off",
    atPlatformOrStairs: context === "platform" || context === "stairs",
  };
}

export function severityFor(category: CivicCategory, answers: TriageAnswers, measured: Measured): Severity {
  switch (category) {
    case "sidewalk_obstruction":
      return answers.wayAround === "none" || measured.blocking > REPORTING.obstructionBlockingForSeverity3 ? 3 : 2;
    case "construction_barrier":
      if (answers.caneWarning) return 2;
      return answers.tripOrDrop ? 4 : 3;
    case "head_height_hazard":
      return 3;
    case "surface_damage":
      return answers.tripOrDrop || measured.measuredDropOff ? 3 : 2;
    case "blocked_curb_cut":
    case "snow_ice":
      return answers.wayAround === "none" ? 3 : 2;
    case "tactile_strip_issue":
      return measured.atPlatformOrStairs ? 4 : 3;
    case "other_fixed":
      return 2;
  }
}

export function minConfidenceFor(category: CivicCategory): number {
  return category === "other_fixed" ? REPORTING.minConfidenceOtherFixed : REPORTING.minConfidence;
}

export type ReportBlock =
  | "no_category"
  | "not_public"
  | "not_left_or_fixed"
  | "low_confidence"
  | "duplicate"
  | "budget_spent";

export interface ReportInput {
  // Null when Gemini picked none: people, vehicles in the road, animals, things being carried.
  category: CivicCategory | null;
  answers: TriageAnswers;
  confidence: number;
  measured: Measured;
  // Same device hash, cell and category in the last 15 minutes. Checked in the database by the route.
  duplicate: boolean;
  budgetLeft: boolean;
}

export interface ReportDecision {
  report: boolean;
  // 1 when there is no category: nothing to fix.
  severity: Severity;
  // Why it was not reported. Empty when report is true.
  blockedBy: ReportBlock[];
}

// The four tests are: public, left or fixed, in the way, and someone can fix it.
// "In the way" always holds here, because the phone only triages hazards inside its walking corridor.
export function decideReport(input: ReportInput): ReportDecision {
  const { category, answers } = input;
  const blockedBy: ReportBlock[] = [];

  if (category === null) blockedBy.push("no_category");
  if (!answers.isPublic) blockedBy.push("not_public");
  if (!answers.leftOrFixed) blockedBy.push("not_left_or_fixed");
  if (category !== null && input.confidence < minConfidenceFor(category)) blockedBy.push("low_confidence");
  if (input.duplicate) blockedBy.push("duplicate");
  if (!input.budgetLeft) blockedBy.push("budget_spent");

  const severity = category === null ? 1 : severityFor(category, answers, input.measured);
  return { report: blockedBy.length === 0, severity, blockedBy };
}

// Severity 4 skips the 3-reporter rule and goes to the "Check now" list.
export function isCheckNow(severity: Severity): boolean {
  return severity >= REPORTING.checkNowSeverity;
}

// Who fixes it, for the dashboard's "Who fixes it" column. Worked out here, never stored.
export function ownerFor(category: CivicCategory, where: { nearStation: boolean; indoor: boolean }): string {
  if (category === "tactile_strip_issue") {
    if (where.nearStation) return "OC Transpo";
    return where.indoor ? "Property owner" : "City of Ottawa";
  }
  return CATEGORY_RULES[category].whoFixesIt;
}
