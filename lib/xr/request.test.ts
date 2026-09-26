import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArUnavailableError, forgetLevel, requestArSession, savedLevel, SESSION_LEVELS, sessionInit } from "./request";

// A phone's WebXR that refuses some setups the way Chrome does, and records what it was asked.
function fakeXr(refuse: (init: XRSessionInit) => DOMException | null) {
  const asked: string[][] = [];
  const xr = {
    requestSession: (_mode: string, init: XRSessionInit) => {
      asked.push(init.optionalFeatures as string[]);
      const error = refuse(init);
      return error ? Promise.reject(error) : Promise.resolve({ fake: true } as unknown as XRSession);
    },
  } as unknown as XRSystem;
  return { xr, asked };
}

const refused = () => new DOMException("The specified session configuration is not supported.", "NotSupportedError");
const overlay = {} as Element;

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("AR session setups", () => {
  it("asks for every feature first, with depth settings only when depth is asked for", () => {
    expect(sessionInit(overlay).optionalFeatures).toEqual([
      "depth-sensing",
      "camera-access",
      "hit-test",
      "dom-overlay",
      "local-floor",
    ]);
    const noDepth = sessionInit(overlay, 1);
    expect(noDepth.optionalFeatures).not.toContain("depth-sensing");
    expect(noDepth.depthSensing).toBeUndefined();
    expect(sessionInit(overlay, 2).optionalFeatures).not.toContain("camera-access");
  });

  it("drops depth when the phone refuses it, and starts there next time", async () => {
    const phone = fakeXr((init) => (init.optionalFeatures?.includes("depth-sensing") ? refused() : null));
    const first = await requestArSession(phone.xr, overlay);
    expect(first.level).toBe(1);
    expect(first.refused).toEqual([`${SESSION_LEVELS[0].name}: The specified session configuration is not supported.`]);
    expect(savedLevel()).toBe(1);
    const next = fakeXr(() => null);
    await requestArSession(next.xr, overlay);
    expect(next.asked).toHaveLength(1);
    expect(next.asked[0]).not.toContain("depth-sensing");
  });

  it("gives up on AR when every setup is refused, and says so without asking again", async () => {
    const phone = fakeXr(() => refused());
    const failed = await requestArSession(phone.xr, overlay).catch((err: unknown) => err);
    expect(failed).toBeInstanceOf(ArUnavailableError);
    expect((failed as ArUnavailableError).refused).toHaveLength(SESSION_LEVELS.length);
    expect(savedLevel()).toBe(SESSION_LEVELS.length);
    const again = fakeXr(() => null);
    await expect(requestArSession(again.xr, overlay)).rejects.toBeInstanceOf(ArUnavailableError);
    expect(again.asked).toHaveLength(0);
    forgetLevel();
    expect(savedLevel()).toBe(0);
  });

  it("doesn't step down for a lost tap or a refused permission", async () => {
    const phone = fakeXr(() => new DOMException("needs a tap", "SecurityError"));
    await expect(requestArSession(phone.xr, overlay)).rejects.toThrow("needs a tap");
    expect(phone.asked).toHaveLength(1);
    expect(savedLevel()).toBe(0);
  });
});
