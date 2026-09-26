"use client";

import { IconArrowRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/brand/Button";
import { Serif } from "@/components/brand/Display";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { PerfResponse } from "@/lib/shared/contracts";
import { cn } from "@/lib/utils";

interface Numbers {
  rows: number;
  rawMs: number;
  aggregateMs: number;
  ratio: number | null;
}

// Measured on a laptop with the labelled simulated fortnight (docs/devpost.md), shown when the
// live numbers can't load.
const MEASURED: Numbers = { rows: 429_000, rawMs: 47, aggregateMs: 14, ratio: 10 };

export function ForTheCity() {
  const [live, setLive] = useState<Numbers | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/perf", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PerfResponse>) : null))
      .then((data) => {
        const l = data?.latest;
        if (l) setLive({ rows: l.totalRows, rawMs: l.rawMs, aggregateMs: l.aggregateMs, ratio: l.compressionRatio });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const n = live ?? MEASURED;
  const stats = [
    { value: n.rows, suffix: "", label: "labelled simulated events" },
    { value: n.rawMs, suffix: " ms", label: "for a 7-day question on the raw table" },
    { value: n.aggregateMs, suffix: " ms", label: "for the same question from the continuous aggregate" },
    ...(n.ratio ? [{ value: n.ratio, suffix: "×", label: "smaller once compressed" }] : []),
  ];

  return (
    <Section
      id="city"
      eyebrow="For the city"
      title={["A fix-first list,", <Serif key="s">ranked in SQL</Serif>]}
      intro="Anonymous reports land in Tiger Data. Continuous aggregates keep the ranking fast, so the city sees which spots to fix first around the O-Train stations."
      tone="ink"
    >
      <div className="mt-16 grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal
            key={s.label}
            delay={0.08 * i}
            className="flex flex-col gap-3 border-b border-line py-8 sm:px-6 sm:[&:nth-child(odd)]:pl-0 lg:border-b-0 lg:[&:not(:first-child)]:border-l lg:[&:nth-child(odd)]:pl-6 lg:first:pl-0"
          >
            <NumberTicker
              value={s.value}
              suffix={s.suffix}
              decimalPlaces={Number.isInteger(s.value) ? 0 : 1}
              className="font-display text-5xl font-extrabold tracking-[-0.04em] sm:text-6xl"
            />
            <span className="max-w-[26ch] text-lg text-muted">{s.label}</span>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2} className="mt-10 flex flex-col gap-5 border border-line p-6 sm:p-8">
        <p className="font-display text-xl font-extrabold tracking-[-0.01em] uppercase">The same 7-day question</p>
        {[
          { name: "Raw table", ms: n.rawMs, colour: "bg-line-strong" },
          { name: "Continuous aggregate", ms: n.aggregateMs, colour: "bg-accent" },
        ].map((bar) => (
          <div key={bar.name} className="grid grid-cols-[9rem_1fr] items-center gap-4 sm:grid-cols-[12rem_1fr]">
            <span className="text-muted">{bar.name}</span>
            <div className="flex items-center gap-3">
              <div
                className={cn("h-4", bar.colour)}
                style={{ width: `${Math.max(4, (bar.ms / Math.max(n.rawMs, n.aggregateMs)) * 80)}%` }}
              />
              <span className="font-mono whitespace-nowrap tabular-nums">{bar.ms} ms</span>
            </div>
          </div>
        ))}
      </Reveal>

      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-md bg-accent px-3 py-1 font-display text-sm font-bold tracking-[0.04em] text-on-accent uppercase">
            Simulated data
          </span>
          <span className="text-muted">
            {live ? "Live from the database" : "Measured locally, the live numbers didn't load"}
          </span>
        </p>
        <ButtonLink href="/map" size="lg">
          Open the city dashboard
          <IconArrowRight aria-hidden size={22} />
        </ButtonLink>
      </div>
    </Section>
  );
}
