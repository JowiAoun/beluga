import { describe, expect, it } from "vitest";
import { AskAnswerSchema, TriageAnswerSchema } from "./answers";

const triage = {
  category: "sidewalk_obstruction",
  isPublic: true,
  leftOrFixed: "true",
  wayAround: "narrow",
  caneWarning: false,
  tripOrDrop: "false",
  confidence: "0.82",
  description: "E-scooter lying across the sidewalk",
  context: "sidewalk",
  box: [400, 100, 900, 800],
};

describe("agent answers", () => {
  it("accepts a triage answer with text for yes/no and numbers", () => {
    const parsed = TriageAnswerSchema.parse(triage);
    expect(parsed.leftOrFixed).toBe(true);
    expect(parsed.tripOrDrop).toBe(false);
    expect(parsed.confidence).toBeCloseTo(0.82, 6);
    expect(parsed.box).toEqual([400, 100, 900, 800]);
  });

  it("reads the box as text or named edges, and drops a bad one", () => {
    expect(TriageAnswerSchema.parse({ ...triage, box: "400, 100, 900, 800" }).box).toEqual([400, 100, 900, 800]);
    expect(TriageAnswerSchema.parse({ ...triage, box: { top: 1, left: 2, bottom: 3, right: 4 } }).box).toEqual([
      1, 2, 3, 4,
    ]);
    expect(TriageAnswerSchema.parse({ ...triage, box: [900, 0, 100, 10] }).box).toBeNull();
    expect(TriageAnswerSchema.parse({ ...triage, box: undefined }).box).toBeNull();
  });

  it("rejects a category outside the list and a long description", () => {
    expect(TriageAnswerSchema.safeParse({ ...triage, category: "pothole" }).success).toBe(false);
    expect(TriageAnswerSchema.safeParse({ ...triage, description: "word ".repeat(16) }).success).toBe(false);
    expect(TriageAnswerSchema.parse({ ...triage, category: "none" }).category).toBe("none");
  });

  it("accepts an Ask answer with no label or box", () => {
    expect(AskAnswerSchema.parse({ answer: "A bench about 2 metres ahead, slightly left." })).toEqual({
      answer: "A bench about 2 metres ahead, slightly left.",
      label: null,
      box: null,
    });
  });
});
