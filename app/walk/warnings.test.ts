import { describe, expect, it } from "vitest";
import type { HazardUpdate } from "@/lib/shared/contracts";
import { cleanWarnFrom, cleanWarningsOff, defaultWarnFrom, distanceIdOf, heardHazards, offText } from "./warnings";

function hazard(id: string, kind: HazardUpdate["kind"], label: HazardUpdate["label"]): HazardUpdate {
  return { id, kind, distance: 2, angle: 0, label, blocking: 0.2, active: true, firstSeenAt: 0, updatedAt: 0 };
}

const BIKE = hazard("o1", "obstacle", "bicycle");
const POLE = hazard("o2", "obstacle", "pole_like");
const WALL = hazard("o3", "obstacle", "unknown");
const DROP = hazard("d1", "drop_off", "unknown");
const HEAD = hazard("h1", "head_height", "unknown");
const ALL = [BIKE, POLE, WALL, DROP, HEAD];

describe("heardHazards", () => {
  it("passes everything through when nothing is off", () => {
    expect(heardHazards(ALL, [], true)).toBe(ALL);
  });

  it("keeps a turned-off object as a plain obstacle when there is depth", () => {
    const heard = heardHazards(ALL, ["bikes"], true);
    expect(heard).toHaveLength(5);
    expect(heard.find((h) => h.id === "o1")?.label).toBe("unknown");
    expect(BIKE.label).toBe("bicycle");
  });

  it("drops a turned-off object in camera-only mode", () => {
    const heard = heardHazards([BIKE, hazard("o4", "obstacle", "person")], ["bikes"], false);
    expect(heard.map((h) => h.id)).toEqual(["o4"]);
  });

  it("covers depth's pole-like label with the poles group", () => {
    expect(heardHazards([POLE], ["poles"], true)[0].label).toBe("unknown");
  });

  it("silences a turned-off depth warning completely", () => {
    const heard = heardHazards(ALL, ["drop_off", "head_height"], true);
    expect(heard.map((h) => h.kind)).toEqual(["obstacle", "obstacle", "obstacle"]);
  });

  it("never touches a plain obstacle", () => {
    const off = ["bikes", "vehicles", "people", "poles", "furniture", "drop_off", "head_height"] as const;
    expect(heardHazards([WALL], off, true)).toEqual([WALL]);
  });
});

describe("cleanWarningsOff", () => {
  it("keeps known ids once, in list order", () => {
    expect(cleanWarningsOff(["head_height", "nope", "bikes", "bikes", 3])).toEqual(["bikes", "head_height"]);
  });

  it("treats anything else as nothing off", () => {
    expect(cleanWarningsOff("bikes")).toEqual([]);
    expect(cleanWarningsOff(undefined)).toEqual([]);
  });
});

describe("offText", () => {
  it("lists the groups that are off", () => {
    expect(offText(["drop_off", "bikes"])).toBe("Bikes and motorcycles, drop-offs and edges");
  });
});

describe("warning distances", () => {
  it("follows the slider for each kind, and everything else for anything unnamed", () => {
    expect(distanceIdOf(DROP)).toBe("drop_off");
    expect(distanceIdOf({ kind: "head_height", label: "unknown" })).toBe("head_height");
    expect(distanceIdOf(BIKE)).toBe("bikes");
    expect(distanceIdOf({ kind: "obstacle", label: "fire_hydrant" })).toBe("poles");
    expect(distanceIdOf(WALL)).toBe("obstacles");
  });

  it("starts at 1 m, 1.5 m for drop-offs, and keeps saved values in range and on a step", () => {
    expect(defaultWarnFrom()).toMatchObject({ people: 1, obstacles: 1, head_height: 1, drop_off: 1.5 });
    const saved = cleanWarnFrom({ people: 2.1, poles: 9, drop_off: 3.4, head_height: 0.1, bikes: "far" });
    expect(saved).toMatchObject({ people: 2, poles: 3, drop_off: 3.5, head_height: 0.5, bikes: 1, obstacles: 1 });
    expect(cleanWarnFrom(null)).toEqual(defaultWarnFrom());
  });
});
