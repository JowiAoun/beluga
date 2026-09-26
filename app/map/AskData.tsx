"use client";

// Ask the data (Phase 7 stretch): a planner types a question, and an ElevenLabs agent looks the
// numbers up with the dashboard's own queries and answers in a sentence or two. The lookups it
// used show under the answer, so the agent and the continuous aggregates are seen working together.

import { IconAlertTriangle, IconMessageQuestion, IconSend, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/brand/Button";
import { CARD } from "@/components/brand/Card";
import { SonarRings } from "@/components/brand/SonarRings";
import type { AskDataResponse } from "@/lib/shared/contracts";
import type { CivicCategory } from "@/lib/shared/enums";
import { STATIONS } from "@/lib/shared/stations";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES } from "./format";
import { PanelHeading } from "./Panels";

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

const WINDOWS: Record<string, string> = {
  "1h": "last hour",
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "14d": "last 14 days",
};
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

export default function AskData({ className }: { className?: string }) {
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
    <section aria-labelledby="ask-data" className={cn(CARD, "flex flex-col gap-4 p-4 sm:p-6", className)}>
      <PanelHeading
        id="ask-data"
        icon={IconMessageQuestion}
        title="Ask the data"
        note="Type a question. An ElevenLabs agent looks the numbers up and answers in a sentence or two."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="flex flex-col gap-2 sm:flex-row"
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
          className="h-13 min-w-0 flex-1 rounded-2xl border border-line bg-abyss px-4 text-lg text-foreground transition-colors duration-150 placeholder:text-muted hover:border-white/30"
        />
        <Button type="submit" disabled={busy || question.trim().length < 3} className="h-13">
          <IconSend aria-hidden size={20} />
          {busy ? "Asking" : "Ask"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-abyss/50 px-4 text-left text-base text-foreground/90 transition-colors duration-150 hover:border-sonar/60 hover:text-foreground disabled:opacity-50"
          >
            <IconSparkles aria-hidden size={18} className="shrink-0 text-sonar" />
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="flex flex-col gap-2">
        {busy && (
          <p className="flex items-center gap-4 rounded-2xl border border-line bg-abyss/50 px-4 py-4 text-muted">
            <span className="relative flex size-6 shrink-0 items-center justify-center">
              <SonarRings className="-inset-2" count={2} duration={2.4} />
              <span className="size-2 rounded-full bg-sonar" />
            </span>
            The agent is looking it up.
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-2xl border border-red-300/40 bg-red-950/30 px-4 py-3 text-red-100">
            <IconAlertTriangle aria-hidden size={22} className="mt-0.5 shrink-0 text-red-300" />
            {error}
          </p>
        )}
        {result && !busy && (
          <div className="rounded-2xl border border-sonar/40 bg-sonar/[0.07] px-4 py-4 shadow-[inset_4px_0_0_var(--sonar)]">
            <p className="text-lg">{result.answer}</p>
            <p className="mt-2 text-base text-muted">
              {result.lookups.length > 0
                ? `Looked at: ${result.lookups.map(describeLookup).join("; ")}.`
                : "Answered without looking anything up."}{" "}
              {result.includesSimulated && "Includes simulated demo data. "}
              <span className="font-mono">{(result.latencyMs / 1000).toFixed(1)} s</span>, by an ElevenLabs agent with
              Gemini, reading Tiger Data continuous aggregates.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
