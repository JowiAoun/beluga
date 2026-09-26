import { describe, expect, it } from "vitest";
import { guardAnswer } from "./ask";

describe("Ask answer guard", () => {
  it.each(["It is safe to cross.", "You can cross now.", "The green light means go ahead.", "Do not cross yet."])("replaces crossing advice: %s", (answer) => {
    const safe = guardAnswer({ answer, box: [0, 0, 100, 100], label: "light", voiceFailed: false });
    expect(safe.answer).toBe("I can't judge traffic. Cross the way you normally do.");
    expect(safe.box).toBeNull();
  });
  it("keeps an ordinary scene answer", () => {
    const answer = { answer: "A barrier blocks the sidewalk on your left.", box: null, label: "barrier", voiceFailed: false };
    expect(guardAnswer(answer)).toEqual(answer);
  });
});
