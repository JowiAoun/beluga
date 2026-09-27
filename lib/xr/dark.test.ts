import { describe, expect, it } from "vitest";
import { DarkCamera } from "./dark";

describe("DarkCamera", () => {
  it("goes dark after half a second of black frames, and back after half a second of light", () => {
    const camera = new DarkCamera();
    expect(camera.update(0, 90)).toBeNull();
    expect(camera.update(250, 3)).toBeNull();
    expect(camera.update(500, 2)).toBeNull();
    expect(camera.update(750, 2)).toBe("dark");
    expect(camera.dark).toBe(true);
    // A dim frame in between the two limits keeps it dark.
    expect(camera.update(1000, 15)).toBeNull();
    expect(camera.update(1250, 60)).toBeNull();
    expect(camera.update(1750, 70)).toBe("light");
    expect(camera.dark).toBe(false);
  });

  it("ignores a single black frame", () => {
    const camera = new DarkCamera();
    for (let t = 0; t < 3000; t += 250) expect(camera.update(t, t === 1000 ? 0 : 80)).toBeNull();
    expect(camera.dark).toBe(false);
  });
});
