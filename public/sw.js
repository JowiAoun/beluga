// beluga's service worker (Phase 9). After one visit online, a walk starts and warns with no
// network: the page, its code, the sounds, the detector's model and WASM are all kept here.
//
// Build chunks and icons never change at their URL, so they come from the cache first. Everything
// else goes to the network first and falls back to the cache: a package update keeps file names
// like vision_wasm_internal.wasm, and a stale copy would break the detector. /api is never cached.

const VERSION = "beluga-v2";

const PRECACHE = [
  "/walk",
  "/walk/sounds",
  "/manifest.webmanifest",
  "/icons/beluga-192.png",
  "/icons/beluga-512.png",
  "/icons/logo-128.png",
  "/3d/beluga.webp",
  "/3d/beluga.glb",
  "/models/efficientdet_lite0.tflite",
  "/mediapipe/wasm/vision_wasm_internal.js",
  "/mediapipe/wasm/vision_wasm_internal.wasm",
  "/sounds/manifest.json",
];

const CACHE_FIRST = [/^\/_next\/static\//, /^\/icons\//];
// A page that doesn't answer in this long comes from the cache instead.
const PAGE_TIMEOUT_MS = 3000;

async function precacheSounds(cache) {
  try {
    const response = await fetch("/sounds/manifest.json");
    if (!response.ok) return;
    const manifest = await response.json();
    const files = [
      ...Object.values(manifest.sounds ?? {}).flatMap((s) => [s.file, s.loop].filter(Boolean)),
      ...Object.values(manifest.clips ?? {}).map((c) => c.file),
    ];
    await Promise.all(files.map((file) => cache.add(`/sounds/${file}`).catch(() => {})));
  } catch {
    // No sound library yet: the tones drawn in code play instead.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // One missing file must not stop the install.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      await precacheSounds(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page lists the build chunks it loaded before this worker took control, so the first visit
// alone is enough to walk offline next time.
self.addEventListener("message", (event) => {
  const urls = event.data?.type === "cache" && Array.isArray(event.data.urls) ? event.data.urls : [];
  const ours = urls.filter((u) => {
    try {
      const url = new URL(u);
      return url.origin === self.location.origin && CACHE_FIRST.some((p) => p.test(url.pathname));
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.all(ours.map((u) => cache.add(u).catch(() => {})))),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}

async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(VERSION);
  try {
    const response = await (timeoutMs
      ? Promise.race([
          fetch(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), timeoutMs)),
        ])
      : fetch(request));
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Pages are cached without their query, so /walk?detector=cpu still opens offline.
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Map tiles and other sites: the network only.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (CACHE_FIRST.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, request.mode === "navigate" ? PAGE_TIMEOUT_MS : 0));
});
