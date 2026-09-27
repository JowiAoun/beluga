import { describe, expect, it } from "vitest";
import { fitLongEdge } from "./cameraImage";
import { gridFor, sampleDepth, type DepthReader } from "./depth";
import { IDENTITY, perspective, yaw } from "./testFixtures";

const constant = (metres: number): DepthReader => ({ getDepthInMeters: () => metres });

describe("sampleDepth", () => {
  it("turns every reading in range into a point at that depth", () => {
    const sample = sampleDepth(constant(2), perspective(40, 55), IDENTITY, { cols: 12, rows: 9 });
    expect(sample.sampleCount).toBe(108);
    expect(sample.validCount).toBe(108);
    const halfWidth = 2 * Math.tan((20 * Math.PI) / 180);
    for (let i = 0; i < sample.points.length; i += 3) {
      expect(sample.points[i + 2]).toBeCloseTo(-2, 5);
      expect(Math.abs(sample.points[i])).toBeLessThan(halfWidth);
    }
  });

  it("drops no reading, NaN, too near and too far", () => {
    // Columns read 0, NaN, 0.1 m, 6 m and 1 m.
    const byColumn = [0, NaN, 0.1, 6, 1];
    const reader: DepthReader = { getDepthInMeters: (u) => byColumn[Math.floor(u * 5)] };
    const sample = sampleDepth(reader, perspective(40, 55), IDENTITY, { cols: 5, rows: 2 });
    expect(sample.sampleCount).toBe(10);
    expect(sample.validCount).toBe(2);
    expect(sample.points.length).toBe(6);
  });

  it("outvotes a speck of noise in a cell", () => {
    // One cell; its centre reads 5 m, the four spots around it 2 m.
    const speck: DepthReader = { getDepthInMeters: (u, v) => (u === 0.5 && v === 0.5 ? 5 : 2) };
    const sample = sampleDepth(speck, perspective(40, 55), IDENTITY, { cols: 1, rows: 1 });
    expect(sample.validCount).toBe(1);
    expect(sample.points[2]).toBeCloseTo(-2, 5);
  });

  it("takes the surface most of a cell sees on an object's edge", () => {
    // A pole 1.5 m away covers the left of the cell; the floor behind it reads 3 m.
    const edge: DepthReader = { getDepthInMeters: (u) => (u < 0.5 ? 1.5 : 3) };
    const sample = sampleDepth(edge, perspective(40, 55), IDENTITY, { cols: 1, rows: 1 });
    expect(sample.points[2]).toBeCloseTo(-3, 5);
  });

  it("leaves out a cell whose readings don't agree, and counts it", () => {
    const readings = [1, 1.6, 2.2, 2.8, 3.4];
    let i = 0;
    const scattered: DepthReader = { getDepthInMeters: () => readings[i++ % readings.length] };
    const sample = sampleDepth(scattered, perspective(40, 55), IDENTITY, { cols: 1, rows: 1 });
    expect(sample.validCount).toBe(0);
    expect(sample.unsteadyCount).toBe(1);
  });

  it("places points with the camera pose", () => {
    const sample = sampleDepth(constant(2), perspective(40, 55), yaw(90, 0, 1.5, 0), { cols: 1, rows: 1 });
    expect(sample.points[0]).toBeCloseTo(-2, 5);
    expect(sample.points[1]).toBeCloseTo(1.5, 5);
    expect(sample.points[2]).toBeCloseTo(0, 5);
  });
});

describe("gridFor", () => {
  it("runs the long side of the grid along the long side of the view", () => {
    expect(gridFor({ horizontal: 40, vertical: 55 })).toEqual({ cols: 36, rows: 48 });
    expect(gridFor({ horizontal: 64, vertical: 38 })).toEqual({ cols: 48, rows: 36 });
  });
});

describe("fitLongEdge", () => {
  it("shrinks to the long edge and keeps the aspect", () => {
    expect(fitLongEdge(640, 480, 320)).toEqual({ width: 320, height: 240 });
    expect(fitLongEdge(1920, 1080, 768)).toEqual({ width: 768, height: 432 });
  });

  it("never scales up", () => {
    expect(fitLongEdge(480, 640, 768)).toEqual({ width: 480, height: 640 });
  });
});
