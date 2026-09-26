import { afterEach, describe, expect, it, vi } from "vitest";
import { cachedSound } from "./cache";
import { fetchLibrary } from "./library";

function memoryCache() {
  const store = new Map<string, Response>();
  return {
    match: vi.fn(async (url: string) => store.get(url)?.clone()),
    put: vi.fn(async (url: string, response: Response) => { store.set(url, response.clone()); }),
  } as unknown as Cache;
}
afterEach(() => vi.unstubAllGlobals());

describe("offline sound cache", () => {
  it("loads a saved manifest and labels with the network unavailable", async () => {
    const cache = memoryCache();
    vi.stubGlobal("caches", { open: async () => cache });
    const manifest = { generatedAt: "v1", sounds: {}, clips: { head: { file: "voice/head.wav", text: "head" } } };
    const fetcher = vi.fn(async (url: string) => url.includes("manifest") ? Response.json(manifest) : new Response(new Uint8Array([1, 2])));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchLibrary())?.offlineReady).toBe(true);
    fetcher.mockRejectedValue(new TypeError("offline"));
    const offline = await fetchLibrary();
    expect(offline?.offlineReady).toBe(true);
    expect([...new Uint8Array(offline!.files.get("voice/head.wav")!)]).toEqual([1, 2]);
  });
  it("does not fetch an already cached clip", async () => {
    const cache = memoryCache();
    await cache.put("/sounds/head.wav", new Response("saved"));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await (await cachedSound("/sounds/head.wav", cache))?.text()).toBe("saved");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("still returns network audio when storage quota is denied", async () => {
    const cache = memoryCache();
    vi.mocked(cache.put).mockRejectedValue(new Error("quota"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("audio")));
    expect(await (await cachedSound("/sounds/head.wav", cache))?.text()).toBe("audio");
  });
  it("does not claim offline readiness with missing files", async () => {
    const cache = memoryCache();
    vi.stubGlobal("caches", { open: async () => cache });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("manifest") ? Response.json({ generatedAt: "v1", sounds: {}, clips: { head: { file: "voice/head.wav" } } }) : new Response(null, { status: 404 })));
    expect((await fetchLibrary())?.offlineReady).toBe(false);
  });
});
