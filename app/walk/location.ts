import { NETWORK } from "@/lib/shared/params";

// Exact values stay in memory on the phone. Events coarsen them before anything is queued (Phase 9).
export interface Fix {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
}

// "prompt" means the question hasn't been asked yet. It is asked before the session,
// because Chrome may not show a permission prompt inside AR.
export async function locationPermission(): Promise<PermissionState | "unknown"> {
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state;
  } catch {
    return "unknown";
  }
}

export function askLocation(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: NETWORK.locationFixTimeoutMs },
    );
  });
}

// Warnings never wait on location. Without a fix, events just have no place yet.
export function watchLocation(onFix: (fix: Fix) => void): () => void {
  if (!("geolocation" in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: NETWORK.locationFixTimeoutMs },
  );
  return () => navigator.geolocation.clearWatch(id);
}
