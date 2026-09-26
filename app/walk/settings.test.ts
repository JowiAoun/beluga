import { afterEach, describe, expect, it, vi } from "vitest";
import { readSettings, saveSettings } from "./settings";
afterEach(() => vi.unstubAllGlobals());

describe("vibration preferences", () => {
  it("migrates older settings without losing other preferences", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ volumeDb: -6, firstRunDone: true }) });
    expect(readSettings()).toMatchObject({ vibrationOn: true, vibrationStrength: "medium", volumeDb: -6, firstRunDone: true });
  });
  it("persists off and the selected strength", () => {
    let stored = "{}";
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } });
    saveSettings({ ...readSettings(), vibrationOn: false, vibrationStrength: "strong" });
    expect(readSettings()).toMatchObject({ vibrationOn: false, vibrationStrength: "strong" });
  });
  it("rejects invalid persisted strength values", () => {
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ vibrationStrength: "maximum", vibrationOn: "yes" }) });
    expect(readSettings()).toMatchObject({ vibrationOn: true, vibrationStrength: "medium" });
  });
});
