"use client";

import { IconArrowRight } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/brand/Button";
import { CARD } from "@/components/brand/Card";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { GlowingEffect } from "@/components/ui/glowing-effect";
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
      title="A fix-first list, ranked in SQL"
      intro="Anonymous reports land in Tiger Data. Continuous aggregates keep the ranking fast, so the city sees which spots to fix first around the O-Train stations."
    >
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={0.08 * i} className={cn(CARD, "relative flex flex-col gap-2 p-6")}>
            <GlowingEffect />
            <NumberTicker
              value={s.value}
              suffix={s.suffix}
              decimalPlaces={Number.isInteger(s.value) ? 0 : 1}
              className="text-4xl font-medium text-foreground sm:text-5xl"
            />
            <span className="text-muted">{s.label}</span>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2} className={cn(CARD, "mt-4 flex flex-col gap-4 p-6 sm:p-8")}>
        <p className="font-semibold">The same 7-day question</p>
        {[
          { name: "Raw table", ms: n.rawMs, colour: "bg-muted/60" },
          { name: "Continuous aggregate", ms: n.aggregateMs, colour: "bg-sonar" },
        ].map((bar) => (
          <div key={bar.name} className="grid grid-cols-[9rem_1fr] items-center gap-4 sm:grid-cols-[12rem_1fr]">
            <span className="text-muted">{bar.name}</span>
            <div className="flex items-center gap-3">
              <div
                className={cn("h-3 rounded-full", bar.colour)}
                style={{ width: `${Math.max(4, (bar.ms / Math.max(n.rawMs, n.aggregateMs)) * 80)}%` }}
              />
              <span className="font-mono whitespace-nowrap tabular-nums">{bar.ms} ms</span>
            </div>
          </div>
        ))}
      </Reveal>

      <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex flex-wrap items-center gap-x-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
          Simulated data
          <span className="font-normal text-foreground/90">
            {live ? "Live from the database" : "Measured locally, the live numbers didn't load"}
          </span>
        </p>
        <ButtonLink href="/map" size="lg">
          Open the city dashboard
          <IconArrowRight
            aria-hidden
            size={22}
            className="transition-transform duration-150 group-hover:translate-x-1"
          />
        </ButtonLink>
      </div>
    </Section>
  );
}
