import { describe, expect, it } from "vitest";
import { EventSchema } from "@/lib/shared/contracts";
import { generate } from "./generate";

const END = new Date("2026-09-26T18:00:00Z");

describe("seed generator", () => {
  it("gives the same rows every run", () => {
    const first = [...generate({ days: 1, end: END })].slice(0, 50);
    const again = [...generate({ days: 1, end: END })].slice(0, 50);
    expect(again).toEqual(first);
  });

  it("makes rows the intake would accept, all in the past", () => {
    const rows = [...generate({ days: 2, end: END })];
    expect(rows.length).toBeGreaterThan(10_000);
    for (const row of rows.slice(0, 2000)) {
      expect(row.time.getTime()).toBeLessThanOrEqual(END.getTime());
      const event = {
        ts: row.time.toISOString(),
        deviceKey: row.deviceKey ?? "simulated-device",
        kind: row.eventKind,
        hazardKind: row.hazardKind,
        detectorClass: row.detectorClass,
        closestDistance: row.closestM,
        angle: row.angleDeg,
        heading: row.headingDeg,
        lat: row.lat,
        lon: row.lon,
        cell: row.cell,
        civic: row.civicCategory
          ? { category: row.civicCategory, severity: row.severity, confidence: row.confidence, description: row.description }
          : null,
      };
      expect(EventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("keeps civic reports to a few percent, on a few spots", () => {
    const rows = [...generate({ days: 2, end: END })];
    const reports = rows.filter((r) => r.eventKind === "civic_report");
    expect(reports.length / rows.length).toBeGreaterThan(0.005);
    expect(reports.length / rows.length).toBeLessThan(0.03);
    expect(new Set(reports.map((r) => `${r.civicCategory}:${r.cell}`)).size).toBeLessThan(60);
  });
});
