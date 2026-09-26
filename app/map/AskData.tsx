"use client";

// Ask the data (Phase 7 stretch): a planner types a question, and an ElevenLabs agent looks the
// numbers up with the dashboard's own queries and answers in a sentence or two. The lookups it
// used show under the answer, so the agent and the continuous aggregates are seen working together.

import { useState } from "react";
import type { AskDataResponse } from "@/lib/shared/contracts";
import type { CivicCategory } from "@/lib/shared/enums";
import { STATIONS } from "@/lib/shared/stations";
import { CATEGORY_NAMES } from "./format";

const SUGGESTIONS = [
  "Which station had the most near-misses this week?",
  "What should the city fix first near Rideau?",
  "What needs checking now?",
];

const LOOKUP_NAMES: Record<string, string> = {
  fix_first_queue: "fix-first queue",
  check_now: "check now",
  busiest_cells: "busiest map cells",
  station_near_misses: "station near-misses",
  recent_reports: "latest reports",
};

const WINDOWS: Record<string, string> = { "1h": "last hour", "24h": "last 24 hours", "7d": "last 7 days", "14d": "last 14 days" };
const SOURCES: Record<string, string> = { live: "live only", simulated: "simulated only", both: "live and simulated" };

const FAILED: Record<number, string> = {
  429: "Ask the data has answered its limit for this hour. Try again later.",
  503: "Ask the data isn't set up on this server yet.",
};

function describeLookup({ tool, filters }: AskDataResponse["lookups"][number]): string {
  const parts: string[] = [];
  if (filters.window) parts.push(WINDOWS[filters.window] ?? filters.window);
  if (filters.station && filters.station !== "all") {
    parts.push(`near ${STATIONS.find((s) => s.id === filters.station)?.name ?? filters.station}`);
  }
  if (filters.category && filters.category !== "all") {
    parts.push(CATEGORY_NAMES[filters.category as CivicCategory] ?? filters.category);
  }
  if (filters.source) parts.push(SOURCES[filters.source] ?? filters.source);
  return `${LOOKUP_NAMES[tool] ?? tool} (${parts.join(", ")})`;
}

export default function AskData() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (text: string) => {
    const q = text.trim();
    if (q.length < 3 || busy) return;
    setQuestion(q);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!response.ok) {
        setResult(null);
        setError(FAILED[response.status] ?? "The agent couldn't answer that. Try again, or ask it another way.");
        return;
      }
      setResult((await response.json()) as AskDataResponse);
    } catch {
      setResult(null);
      setError("No connection to the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="ask-data" className="flex flex-col gap-2 rounded-lg border border-neutral-600 p-3">
      <h2 id="ask-data" className="text-lg font-bold">
        Ask the data
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex flex-wrap gap-2"
      >
        <label htmlFor="ask-data-question" className="sr-only">
          Your question about the hazard data
        </label>
        <input
          id="ask-data-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          placeholder="Which station had the most near-misses this week?"
          className="min-h-10 min-w-0 flex-1 rounded bg-neutral-800 px-3"
        />
        <button
          type="submit"
          disabled={busy || question.trim().length < 3}
          className="min-h-10 rounded bg-yellow-300 px-4 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Asking" : "Ask"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="rounded border border-neutral-600 px-2 py-1 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="flex flex-col gap-1">
        {error && <p className="text-red-300">{error}</p>}
        {result && (
          <>
            <p className="text-lg">{result.answer}</p>
            <p className="text-sm opacity-80">
              {result.lookups.length > 0
                ? `Looked at: ${result.lookups.map(describeLookup).join("; ")}.`
                : "Answered without looking anything up."}{" "}
              {result.includesSimulated && "Includes simulated demo data. "}
              {(result.latencyMs / 1000).toFixed(1)} s, by an ElevenLabs agent with Gemini, reading Tiger Data
              continuous aggregates.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
