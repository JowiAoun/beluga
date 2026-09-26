"use client";

// Pause motion and reduced motion as plain React hooks, with no animation library, so pages
// that must stay light (like /walk) can read them too.

import { useSyncExternalStore } from "react";

const KEY = "beluga-motion";
const EVENT = "beluga-motion";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// The layout's inline script sets the attribute before the first paint, so the DOM is the truth.
function isPaused() {
  return document.documentElement.dataset.motion === "paused";
}

export function setPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = "paused";
  else delete document.documentElement.dataset.motion;
  try {
    if (paused) localStorage.setItem(KEY, "paused");
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage. The switch still works for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePaused() {
  return useSyncExternalStore(subscribe, isPaused, () => false);
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Motion's useReducedMotion reads the setting in the first render, which doesn't match the
// server's HTML. This one starts from the server's answer and updates after hydration.
export function useReducedMotionSafe() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

// True when nothing should move by itself: the Pause motion switch or the system's reduced motion.
export function useStill() {
  const paused = usePaused();
  const reduced = useReducedMotionSafe();
  return paused || reduced;
}
