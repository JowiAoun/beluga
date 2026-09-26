import { describe, expect, it } from "vitest";
import { CROSSING_LINE, hasCrossingAdvice, withoutCrossingAdvice } from "./safety";

describe("crossing advice", () => {
  it("catches the ways a model says it is safe to cross", () => {
    for (const text of [
      "It is safe to cross.",
      "The walk sign is on, so you can cross now.",
      "It's okay to cross",
      "Looks clear to cross.",
      "Go ahead and cross the street.",
      "It's fine for you to cross",
      "You may safely cross.",
      "Cross now while it's white.",
    ]) {
      expect(hasCrossingAdvice(text), text).toBe(true);
    }
  });

  it("leaves plain descriptions alone", () => {
    for (const text of [
      "A crosswalk is ahead, about 3 metres.",
      "The signal appears to show a walking person.",
      "A cross-shaped sign on the right.",
    ]) {
      expect(hasCrossingAdvice(text), text).toBe(false);
    }
  });

  it("swaps only the sentence with advice, once", () => {
    expect(withoutCrossingAdvice("The signal shows a walking person. It is safe to cross.")).toBe(
      `The signal shows a walking person. ${CROSSING_LINE}`,
    );
    expect(withoutCrossingAdvice("Safe to cross. You can cross now.")).toBe(CROSSING_LINE);
    expect(withoutCrossingAdvice("A bench on your left.")).toBe("A bench on your left.");
  });
});
