"use client";

import { IconAlertTriangle, IconMessageReport, IconStack2, IconUsers, type Icon } from "@tabler/icons-react";
import { CARD } from "@/components/brand/Card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { CellRow, PerfSnapshot, QueueRow } from "@/lib/shared/contracts";
import { cn } from "@/lib/utils";
import type { Load } from "./usePoll";

interface Stat {
  label: string;
  icon: Icon;
  value: number | null;
  load: Load;
  note: string;
  decimals?: number;
  suffix?: string;
  // Shown in place of the number when the data came back without one.
  none?: string;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function Stats({
  cells,
  queue,
  perf,
  cellsLoad,
  queueLoad,
  perfLoad,
  windowName,
}: {
  cells: CellRow[] | null;
  queue: QueueRow[] | null;
  perf: PerfSnapshot | null;
  cellsLoad: Load;
  queueLoad: Load;
  perfLoad: Load;
  windowName: string;
}) {
  const stats: Stat[] = [
    {
      label: "Reports",
      icon: IconMessageReport,
      value: cells && sum(cells.map((c) => c.reports)),
      load: cellsLoad,
      note: `Civic reports, last ${windowName}`,
    },
    {
      label: "Reporters",
      icon: IconUsers,
      // The API counts distinct reporters per spot, so one person on two spots counts twice.
      value: queue && sum(queue.map((q) => q.reporters)),
      load: queueLoad,
      note: "On fix-first spots, counted per spot",
    },
    {
      label: "Near-misses",
      icon: IconAlertTriangle,
      value: cells && sum(cells.map((c) => c.nearMisses)),
      load: cellsLoad,
      note: `Last ${windowName}, all five stations`,
    },
    {
      label: "Compression",
      icon: IconStack2,
      value: perf?.compressionRatio ?? null,
      load: perfLoad,
      decimals: 1,
      suffix: "×",
      none: "None yet",
      note: "Smaller once older rows are compressed",
    },
  ];

  return (
    <section aria-labelledby="totals">
      <h2 id="totals" className="sr-only">
        Totals
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="relative rounded-3xl">
            <GlowingEffect />
            <div
              className={cn(
                CARD,
                "flex h-full flex-col gap-2 p-4 transition-colors duration-150 hover:border-white/20 sm:p-6",
              )}
            >
              <p className="flex items-center gap-2 text-base font-semibold text-muted">
                <s.icon aria-hidden size={24} className="shrink-0 text-sonar" />
                {s.label}
              </p>
              <p className="font-mono text-3xl leading-tight font-medium sm:text-5xl">
                {s.value !== null ? (
                  <NumberTicker value={s.value} decimalPlaces={s.decimals ?? 0} suffix={s.suffix} />
                ) : (
                  <span className="text-2xl text-muted sm:text-3xl">
                    {s.load === "ready" ? (s.none ?? "None") : s.load === "offline" ? "No data" : "Loading"}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted sm:text-base">{s.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
