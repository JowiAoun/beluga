import { describe, expect, it } from "vitest";
import { CIVIC_CATEGORIES } from "./enums";
import {
  CATEGORY_RULES,
  RULES,
  decideReport,
  isCheckNow,
  measuredFrom,
  ownerFor,
  severityFor,
  type Measured,
  type ReportInput,
  type TriageAnswers,
} from "./reporting";

const answers = (over: Partial<TriageAnswers> = {}): TriageAnswers => ({
  isPublic: true,
  leftOrFixed: true,
  wayAround: "clear",
  caneWarning: true,
  tripOrDrop: false,
  ...over,
});

const measured = (over: Partial<Measured> = {}): Measured => ({
  blocking: 0.3,
  measuredDropOff: false,
  atPlatformOrStairs: false,
  ...over,
});

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  category: "sidewalk_obstruction",
  answers: answers(),
  confidence: 0.9,
  measured: measured(),
  duplicate: false,
  budgetLeft: true,
  ...over,
});

describe("category table", () => {
  it("has a row for every category, and every row cites known rules", () => {
    for (const category of CIVIC_CATEGORIES) {
      const row = CATEGORY_RULES[category];
      expect(row.baseSeverity).toBeGreaterThanOrEqual(2);
      for (const rule of row.rules) expect(RULES[rule]).toBeDefined();
    }
  });

  it("gives the base severity when nothing makes it worse", () => {
    for (const category of CIVIC_CATEGORIES) {
      expect(severityFor(category, answers(), measured())).toBe(CATEGORY_RULES[category].baseSeverity);
    }
  });
});

describe("severityFor", () => {
  it("sidewalk_obstruction: 2, or 3 with no way around or blocking over 0.6", () => {
    expect(severityFor("sidewalk_obstruction", answers({ wayAround: "narrow" }), measured())).toBe(2);
    expect(severityFor("sidewalk_obstruction", answers({ wayAround: "none" }), measured())).toBe(3);
    expect(severityFor("sidewalk_obstruction", answers(), measured({ blocking: 0.6 }))).toBe(2);
    expect(severityFor("sidewalk_obstruction", answers(), measured({ blocking: 0.61 }))).toBe(3);
  });

  it("construction_barrier: 2 with a cane warning, 3 without, 4 without and with a trip or drop", () => {
    expect(severityFor("construction_barrier", answers({ caneWarning: true, tripOrDrop: true }), measured())).toBe(2);
    expect(severityFor("construction_barrier", answers({ caneWarning: false }), measured())).toBe(3);
    expect(severityFor("construction_barrier", answers({ caneWarning: false, tripOrDrop: true }), measured())).toBe(4);
  });

  it("head_height_hazard: always 3", () => {
    expect(severityFor("head_height_hazard", answers({ wayAround: "none", tripOrDrop: true }), measured())).toBe(3);
  });

  it("surface_damage: 3 with a trip or drop, or a measured drop-off", () => {
    expect(severityFor("surface_damage", answers({ tripOrDrop: true }), measured())).toBe(3);
    expect(severityFor("surface_damage", answers(), measured({ measuredDropOff: true }))).toBe(3);
  });

  it("blocked_curb_cut and snow_ice: 3 only with no way around", () => {
    for (const category of ["blocked_curb_cut", "snow_ice"] as const) {
      expect(severityFor(category, answers({ wayAround: "narrow" }), measured({ blocking: 1 }))).toBe(2);
      expect(severityFor(category, answers({ wayAround: "none" }), measured())).toBe(3);
    }
  });

  it("tactile_strip_issue: 4 at a platform edge or top of stairs", () => {
    expect(severityFor("tactile_strip_issue", answers(), measured({ atPlatformOrStairs: true }))).toBe(4);
    expect(measuredFrom({ kind: "drop_off", blocking: 1 }, "platform").atPlatformOrStairs).toBe(true);
    expect(measuredFrom({ kind: "obstacle", blocking: 1 }, "crosswalk").atPlatformOrStairs).toBe(false);
  });

  it("other_fixed: stays at 2 whatever the answers", () => {
    const worst = answers({ wayAround: "none", caneWarning: false, tripOrDrop: true });
    expect(severityFor("other_fixed", worst, measured({ blocking: 1, measuredDropOff: true }))).toBe(2);
  });
});

describe("decideReport", () => {
  it("needs 0.7 confidence, and 0.85 for other_fixed", () => {
    expect(decideReport(input({ confidence: 0.69 })).blockedBy).toEqual(["low_confidence"]);
    expect(decideReport(input({ confidence: 0.7 })).report).toBe(true);
    expect(decideReport(input({ category: "other_fixed", confidence: 0.84 })).report).toBe(false);
    expect(decideReport(input({ category: "other_fixed", confidence: 0.85 })).report).toBe(true);
  });

  it("drops duplicates and calls past the budget", () => {
    expect(decideReport(input({ duplicate: true })).blockedBy).toEqual(["duplicate"]);
    expect(decideReport(input({ budgetLeft: false })).blockedBy).toEqual(["budget_spent"]);
  });

  it("drops private places", () => {
    expect(decideReport(input({ answers: answers({ isPublic: false }) })).blockedBy).toEqual(["not_public"]);
  });

  it("marks severity 4 for Check now", () => {
    expect(isCheckNow(4)).toBe(true);
    expect(isCheckNow(3)).toBe(false);
  });
});

// The Phase 5 test set, with the answers Gemini should give for each photo.
describe("Phase 5 test set", () => {
  it("scooter across the sidewalk with room to pass: report, severity 2", () => {
    const d = decideReport(input({ answers: answers({ wayAround: "narrow" }), measured: measured({ blocking: 0.4 }) }));
    expect(d).toEqual({ report: true, severity: 2, blockedBy: [] });
  });

  it("scooter across the whole sidewalk: report, severity 3", () => {
    const d = decideReport(input({ answers: answers({ wayAround: "none" }), measured: measured({ blocking: 0.95 }) }));
    expect(d).toEqual({ report: true, severity: 3, blockedBy: [] });
  });

  it("head-height sign: report, severity 3", () => {
    const d = decideReport(input({ category: "head_height_hazard", answers: answers({ caneWarning: false }) }));
    expect(d).toEqual({ report: true, severity: 3, blockedBy: [] });
  });

  it("construction area marked with tape only: report, severity 3", () => {
    const d = decideReport(input({ category: "construction_barrier", answers: answers({ caneWarning: false }) }));
    expect(d).toEqual({ report: true, severity: 3, blockedBy: [] });
  });

  it("construction with no cane warning and an open trench: report, severity 4, Check now", () => {
    const d = decideReport(
      input({ category: "construction_barrier", answers: answers({ caneWarning: false, tripOrDrop: true }) }),
    );
    expect(d).toEqual({ report: true, severity: 4, blockedBy: [] });
    expect(isCheckNow(d.severity)).toBe(true);
  });

  it("someone riding a scooter: no report", () => {
    const d = decideReport(input({ answers: answers({ leftOrFixed: false }) }));
    expect(d.report).toBe(false);
    expect(d.blockedBy).toEqual(["not_left_or_fixed"]);
  });

  it("person walking, car in the road, empty hallway: no report", () => {
    const person = decideReport(input({ category: null, answers: answers({ leftOrFixed: false }) }));
    const car = decideReport(input({ category: null }));
    const hallway = decideReport(input({ category: null, answers: answers({ isPublic: true }), confidence: 0.95 }));
    for (const d of [person, car, hallway]) {
      expect(d.report).toBe(false);
      expect(d.severity).toBe(1);
      expect(d.blockedBy).toContain("no_category");
    }
  });

  it("edge with the yellow strip intact: no report", () => {
    const d = decideReport(
      input({ category: null, measured: measuredFrom({ kind: "drop_off", blocking: 1 }, "platform") }),
    );
    expect(d.report).toBe(false);
  });
});

describe("ownerFor", () => {
  it("sends tactile strips to OC Transpo near a station, the City at curbs, the owner indoors", () => {
    expect(ownerFor("tactile_strip_issue", { nearStation: true, indoor: true })).toBe("OC Transpo");
    expect(ownerFor("tactile_strip_issue", { nearStation: false, indoor: false })).toBe("City of Ottawa");
    expect(ownerFor("tactile_strip_issue", { nearStation: false, indoor: true })).toBe("Property owner");
  });

  it("uses the table for every other category", () => {
    expect(ownerFor("snow_ice", { nearStation: true, indoor: false })).toBe("City winter maintenance");
    expect(ownerFor("surface_damage", { nearStation: false, indoor: false })).toBe("City roads and sidewalks");
  });
});
