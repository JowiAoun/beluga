import { describe, expect, it } from "vitest";
import {
  AskMetaSchema,
  BoxSchema,
  EventBatchEnvelopeSchema,
  EventSchema,
  FrameSchema,
  countWords,
  decodeAskMeta,
  encodeAskMeta,
} from "./contracts";
import { audioBandFor, headHeightTopM } from "./params";

const nearMiss = {
  ts: "2026-09-26T16:00:00.000Z",
  deviceKey: "3f1c2a9e-0000-4000-8000-000000000000",
  kind: "near_miss",
  hazardKind: "obstacle",
  detectorClass: "chair",
  closestDistance: 0.9,
  lat: 45.42,
  lon: -75.683,
  cell: "f244m5c",
};

describe("EventSchema", () => {
  it("accepts a near-miss with only the required fields", () => {
    expect(EventSchema.safeParse(nearMiss).success).toBe(true);
  });

  it("needs civic fields on a civic report", () => {
    expect(EventSchema.safeParse({ ...nearMiss, kind: "civic_report" }).success).toBe(false);
    const civic = { category: "sidewalk_obstruction", severity: 2, confidence: 0.8, description: "E-scooter lying across the sidewalk" };
    expect(EventSchema.safeParse({ ...nearMiss, kind: "civic_report", civic }).success).toBe(true);
  });

  it("rejects a description over 15 words and a severity out of range", () => {
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";
    expect(countWords(long)).toBe(16);
    const civic = { category: "snow_ice", severity: 2, confidence: 0.8, description: long };
    expect(EventSchema.safeParse({ ...nearMiss, kind: "civic_report", civic }).success).toBe(false);
    const badSeverity = { ...civic, description: "Snowbank", severity: 5 };
    expect(EventSchema.safeParse({ ...nearMiss, kind: "civic_report", civic: badSeverity }).success).toBe(false);
  });

  it("rejects a bad cell and an unknown detector class", () => {
    expect(EventSchema.safeParse({ ...nearMiss, cell: "f244m5" }).success).toBe(false);
    expect(EventSchema.safeParse({ ...nearMiss, detectorClass: "scooter" }).success).toBe(false);
  });
});

describe("EventBatchEnvelopeSchema", () => {
  it("rejects a batch without a consent version", () => {
    expect(EventBatchEnvelopeSchema.safeParse({ events: [nearMiss] }).success).toBe(false);
    expect(EventBatchEnvelopeSchema.safeParse({ events: [nearMiss], consentVersion: 1 }).success).toBe(true);
  });
});

describe("BoxSchema and FrameSchema", () => {
  it("keeps boxes in 0 to 1000 with edges in order", () => {
    expect(BoxSchema.safeParse([100, 200, 300, 400]).success).toBe(true);
    expect(BoxSchema.safeParse([300, 200, 100, 400]).success).toBe(false);
    expect(BoxSchema.safeParse([0, 0, 1001, 10]).success).toBe(false);
  });

  it("takes JPEG base64 and nothing else", () => {
    expect(FrameSchema.safeParse("/9j/4AAQSkZJRg==").success).toBe(true);
    expect(FrameSchema.safeParse("iVBORw0KGgo=").success).toBe(false);
  });
});

describe("Ask meta header", () => {
  it("survives a round trip through the header", () => {
    const meta = AskMetaSchema.parse({ answer: "A chair, 2 metres ahead, slightly left.", label: "chair", box: [400, 300, 900, 500], voiceFailed: false });
    expect(decodeAskMeta(encodeAskMeta(meta))).toEqual(meta);
    expect(decodeAskMeta("not json")).toBeNull();
  });
});

describe("params helpers", () => {
  it("sets the head-height top from the user's height", () => {
    expect(headHeightTopM()).toBeCloseTo(1.95);
    expect(headHeightTopM(1.7)).toBeCloseTo(1.8);
  });

  it("picks audio bands, with drop-offs shifted one band outward", () => {
    expect(audioBandFor(3.2, "obstacle")).toBeNull();
    expect(audioBandFor(3.2, "drop_off")?.repeatMs).toBe(700);
    expect(audioBandFor(0.4, "obstacle")?.repeatMs).toBe(80);
    expect(audioBandFor(0.9, "drop_off")?.repeatMs).toBe(80);
    expect(audioBandFor(1.8, "head_height")?.repeatMs).toBe(350);
  });
});
