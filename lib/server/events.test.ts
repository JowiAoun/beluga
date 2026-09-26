import { describe, expect, it } from "vitest";
import { cellOf } from "@/lib/shared/geo";
import { deviceHash, prepareEvents } from "./events";

const NOW = Date.parse("2026-09-26T18:00:00Z");

function event(extra: Record<string, unknown> = {}) {
  return {
    ts: "2026-09-26T17:59:00Z",
    deviceKey: "device-key-123",
    kind: "near_miss",
    hazardKind: "obstacle",
    detectorClass: "bicycle",
    closestDistance: 0.8,
    lat: 45.42654321,
    lon: -75.69198765,
    cell: "f244mtd",
    ...extra,
  };
}

const civic = { category: "sidewalk_obstruction", severity: 2, confidence: 0.9, description: "Scooter across the path" };

describe("event intake", () => {
  it("rounds the location again and recomputes the cell", () => {
    const { rows } = prepareEvents([event({ cell: "zzzzzzz" })], 1, "salt", NOW);
    expect(rows[0]).toMatchObject({ lat: 45.427, lon: -75.692, cell: cellOf(45.427, -75.692) });
  });

  it("hashes the device key on civic reports only, and never keeps the key", () => {
    const { rows } = prepareEvents([event(), event({ kind: "civic_report", civic })], 1, "salt", NOW);
    expect(rows[0].device_hash).toBeNull();
    expect(rows[1].device_hash).toBe(deviceHash("device-key-123", "salt"));
    expect(rows[1].device_hash).toHaveLength(16);
    expect(JSON.stringify(rows)).not.toContain("device-key-123");
  });

  it("drops civic fields from other events", () => {
    const { rows } = prepareEvents([event({ civic })], 1, "salt", NOW);
    expect(rows[0]).toMatchObject({ civic_category: null, severity: null, description: null, confidence: null });
  });

  it("rejects bad, old and future events one by one", () => {
    const { rows, rejected } = prepareEvents(
      [
        event(),
        event({ ts: "2026-09-18T18:00:00Z" }),
        event({ ts: "2026-09-26T18:10:00Z" }),
        event({ kind: "civic_report" }),
        { nonsense: true },
      ],
      1,
      "salt",
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rejected).toBe(4);
  });
});
