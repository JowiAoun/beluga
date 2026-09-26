import { describe, expect, it } from "vitest";
import { cellBounds, cellCentre, cellOf, coarsen, isCell } from "./geo";

describe("coarsen", () => {
  it("rounds to 3 decimals", () => {
    expect(coarsen(45.42049, -75.68284)).toEqual({ lat: 45.42, lon: -75.683 });
    expect(coarsen(45.4265, -75.692)).toEqual({ lat: 45.427, lon: -75.692 });
  });

  it("is stable when run twice, as the phone and the backend both do", () => {
    const once = coarsen(45.41234, -75.70456);
    expect(coarsen(once.lat, once.lon)).toEqual(once);
  });
});

describe("cellOf", () => {
  it("gives a 7-character geohash of the coarsened point", () => {
    const cell = cellOf(45.4205, -75.6828);
    expect(cell).toHaveLength(7);
    expect(isCell(cell)).toBe(true);
    expect(cell.startsWith("f24")).toBe(true);
  });

  it("puts points that coarsen the same into the same cell", () => {
    expect(cellOf(45.42049, -75.68284)).toBe(cellOf(45.4201, -75.6831));
  });

  it("has a centre inside its bounds", () => {
    const cell = cellOf(45.4265, -75.692);
    const { lat, lon } = cellCentre(cell);
    const b = cellBounds(cell);
    expect(lat).toBeGreaterThan(b.south);
    expect(lat).toBeLessThan(b.north);
    expect(lon).toBeGreaterThan(b.west);
    expect(lon).toBeLessThan(b.east);
  });
});

describe("isCell", () => {
  it("rejects wrong lengths and letters geohash never uses", () => {
    expect(isCell("f244m5")).toBe(false);
    expect(isCell("f244m5a")).toBe(false);
  });
});
