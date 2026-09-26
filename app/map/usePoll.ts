"use client";

import { useEffect, useState } from "react";

export interface Polled<T> {
  data: T | null;
  error: string | null;
}

// Fetches `url` now and every `everyMs`, starting over whenever the url changes.
// `refresh` changes force a fetch now, for a button that measures again.
export function usePoll<T>(url: string | null, everyMs: number | null, refresh = 0): Polled<T> {
  const [state, setState] = useState<Polled<T>>({ data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = (await response.json()) as T & { error?: string };
        if (stopped) return;
        if (!response.ok) setState((s) => ({ data: s.data, error: body.error ?? `${response.status}` }));
        else setState({ data: body, error: null });
      } catch {
        if (!stopped) setState((s) => ({ data: s.data, error: "offline" }));
      }
    };
    void load();
    const id = everyMs === null ? null : window.setInterval(() => void load(), everyMs);
    return () => {
      stopped = true;
      if (id !== null) window.clearInterval(id);
    };
  }, [url, everyMs, refresh]);
  return state;
}

export type Load = "loading" | "offline" | "ready";

// Whether a poll has answered yet, and whether its last try failed with nothing to show.
export function loadOf(poll: Polled<unknown>): Load {
  if (poll.data) return "ready";
  return poll.error ? "offline" : "loading";
}
