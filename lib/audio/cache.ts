// Best Use of ElevenLabs: persist generated audio before a walk; playback only uses memory.
import { SOUND_CACHE } from "@/lib/shared/params";

export async function soundCache(): Promise<Cache | null> {
  try {
    return typeof caches === "undefined" ? null : await caches.open(SOUND_CACHE.name);
  } catch {
    return null;
  }
}

export async function cachedSound(url: string, cache: Cache | null, refresh = false): Promise<Response | null> {
  const saved = await cache?.match(url).catch(() => undefined);
  if (saved && !refresh) return saved;
  try {
    const response = await fetch(url, { cache: "no-cache", signal: AbortSignal.timeout(SOUND_CACHE.fetchTimeoutMs) });
    if (!response.ok) return saved ?? null;
    // A denied quota must never stop in-memory playback.
    await cache?.put(url, response.clone()).catch(() => {});
    return response;
  } catch {
    return saved ?? null;
  }
}
