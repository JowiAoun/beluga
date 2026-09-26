"use client";

import {
  IconActivity,
  IconAlertOctagon,
  IconChevronRight,
  IconGauge,
  IconListNumbers,
  IconMapPin,
  IconPointer,
  IconRefresh,
  IconScale,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { Button } from "@/components/brand/Button";
import { CARD } from "@/components/brand/Card";
import { useStill } from "@/components/brand/MotionPrefs";
import { SonarRings } from "@/components/brand/SonarRings";
import { BorderBeam } from "@/components/ui/border-beam";
import type { CellRow, FeedRow, PerfSnapshot, QueueRow, UrgentRow } from "@/lib/shared/contracts";
import type { Severity } from "@/lib/shared/enums";
import { CATEGORY_RULES, RULES } from "@/lib/shared/reporting";
import { cn } from "@/lib/utils";
import { CATEGORY_NAMES, NO_REPORT_COLOUR, SCORE_COLOURS, SEVERITY_NAMES, seenAgo, timeOfDay, whyLine } from "./format";
import type { Load } from "./usePoll";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function PanelHeading({
  id,
  icon: Icon,
  title,
  note,
  tone = "sonar",
  children,
}: {
  id: string;
  icon: Icon;
  title: string;
  note?: React.ReactNode;
  tone?: "sonar" | "danger";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2.5 text-xl font-bold sm:text-2xl">
          <Icon aria-hidden size={24} className={cn("shrink-0", tone === "sonar" ? "text-sonar" : "text-red-300")} />
          {title}
        </h2>
        {note && <p className="mt-1 max-w-[65ch] text-base text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

// What a panel shows before it has rows: loading, waiting for the database, or truly empty.
export function Empty({ load, children }: { load: Load; children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-white/15 px-4 py-5 text-muted">
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        {load !== "ready" && <SonarRings className="-inset-2" count={2} duration={2.4} />}
        <span className={cn("size-2 rounded-full", load === "ready" ? "bg-muted" : "bg-sonar")} />
      </span>
      <p>{load === "loading" ? "Loading." : load === "offline" ? "Waiting for the database." : children}</p>
    </div>
  );
}

export function SourceBadge({ source }: { source: "live" | "simulated" }) {
  return source === "live" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/40">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-300" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-background">
      Simulated
    </span>
  );
}

// The number and its word, with four pips that fill up to it. The pips are decoration.
export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-sm whitespace-nowrap ring-1",
        severity === 4 ? "bg-red-500/15 text-red-100 ring-red-300/50" : "bg-white/5 text-foreground ring-line",
      )}
    >
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={cn(
              "w-1 rounded-full",
              n <= severity ? (severity === 4 ? "bg-red-300" : "bg-sonar") : "bg-white/15",
            )}
            style={{ height: 4 + n * 2 }}
          />
        ))}
      </span>
      <span>
        <span className="font-mono font-medium">{severity}</span> {SEVERITY_NAMES[severity]}
      </span>
    </span>
  );
}

function formatDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Severity 4: the spots to check today, by cell and day only.
export function CheckNow({
  rows,
  load,
  selected,
  onSelect,
}: {
  rows: UrgentRow[];
  load: Load;
  selected: string | null;
  onSelect: (cell: string) => void;
}) {
  return (
    <section
      aria-labelledby="check-now"
      className={cn(CARD, "overflow-hidden border-red-300/35 bg-red-950/25 p-4 sm:p-6 contrast-more:border-red-300")}
    >
      <BorderBeam size={140} duration={9} borderWidth={2} />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-red-500/15 blur-3xl contrast-more:hidden"
      />
      <PanelHeading
        id="check-now"
        icon={IconAlertOctagon}
        tone="danger"
        title="Check now"
        note="Severity 4: a fall risk. These skip the 3 reporter rule and show the day only, never the time."
      />
      {rows.length === 0 ? (
        <Empty load={load}>Nothing at severity 4 in the last 14 days.</Empty>
      ) : (
        <ul className="relative mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <li key={`${r.cell}-${r.category}-${r.day}-${r.source}`}>
              <button
                type="button"
                onClick={() => onSelect(r.cell)}
                aria-pressed={selected === r.cell}
                className={cn(
                  "group flex min-h-11 w-full items-start gap-3 rounded-2xl border bg-abyss/70 p-3 text-left transition-colors duration-150 hover:border-red-200/70",
                  selected === r.cell ? "border-red-200/80" : "border-red-300/25",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{CATEGORY_NAMES[r.category]}</span>
                    <SourceBadge source={r.source} />
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground/90">
                    <IconMapPin aria-hidden size={18} className="shrink-0 text-red-300" />
                    {r.placeLabel}
                  </span>
                  <span className="text-sm text-muted">
                    {formatDay(r.day)}, {r.whoFixesIt}
                  </span>
                </span>
                <span className="mt-1 hidden shrink-0 items-center gap-1 text-sm font-semibold text-red-200 sm:inline-flex">
                  Map
                  <IconChevronRight
                    aria-hidden
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Sticky cells need a solid fill so the rows scroll under them.
const STICKY_BG = "bg-abyss";
const SELECTED_BG = "bg-[color-mix(in_oklab,var(--sonar)_14%,var(--abyss))]";

export function QueueTable({
  rows,
  load,
  selected,
  onSelect,
  className,
}: {
  rows: QueueRow[];
  load: Load;
  selected: string | null;
  onSelect: (cell: string) => void;
  className?: string;
}) {
  const top = Math.max(1, ...rows.map((r) => r.score));
  const th = "sticky top-0 z-10 border-b border-line bg-[#0d1726] px-3 py-3 text-sm font-semibold text-muted";
  return (
    <section aria-labelledby="fix-first" className={cn(CARD, "p-4 sm:p-6", className)}>
      <PanelHeading
        id="fix-first"
        icon={IconListNumbers}
        title="Fix-first queue"
        note="Last 14 days, 3 or more reporters. Pick a place to see it on the map and read why it ranks there."
      />
      {rows.length === 0 ? (
        <Empty load={load}>No spot has 3 reporters yet.</Empty>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Fix-first queue table, scrolls sideways"
          className="mt-4 max-h-[36rem] overflow-auto lg:max-h-[44rem] overscroll-x-contain rounded-2xl border border-line bg-abyss"
        >
          <table className="w-full min-w-[66rem] border-separate border-spacing-0 text-left text-base">
            <caption className="sr-only">
              Fix-first queue: spots ranked by score, highest first. The place buttons show a spot on the map.
            </caption>
            <thead>
              <tr>
                <th scope="col" className={cn(th, "left-0 z-20 w-14 text-center")}>
                  Rank
                </th>
                <th scope="col" className={cn(th, "left-14 z-20 w-44 sm:w-auto sm:min-w-72")}>
                  Place
                </th>
                <th scope="col" className={th}>
                  Category
                </th>
                <th scope="col" className={th}>
                  Who fixes it
                </th>
                <th scope="col" className={th}>
                  Severity
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Reporters
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Near-misses
                </th>
                <th scope="col" className={th}>
                  Last seen
                </th>
                <th scope="col" className={cn(th, "min-w-36")}>
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const on = selected === r.cell;
                const td = cn("border-b border-line px-3 py-3 align-top", on && `${SELECTED_BG} border-sonar/40`);
                return (
                  <tr key={`${r.cell}-${r.category}`}>
                    <td
                      className={cn(
                        td,
                        "sticky left-0 z-[5] text-center font-mono text-lg font-medium",
                        on ? "text-sonar shadow-[inset_4px_0_0_var(--sonar)]" : cn(STICKY_BG, "text-foreground"),
                      )}
                    >
                      {i + 1}
                    </td>
                    <th
                      scope="row"
                      className={cn(
                        td,
                        "sticky left-14 z-[5] w-44 text-left font-normal shadow-[10px_0_12px_-10px_rgb(0_0_0/0.9)] sm:w-auto sm:min-w-72",
                        !on && STICKY_BG,
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-2">
                        <button
                          type="button"
                          onClick={() => onSelect(r.cell)}
                          aria-pressed={on}
                          className="-mx-1 -my-1 flex min-h-11 items-start gap-1.5 rounded-lg px-1 py-1 text-left font-bold text-foreground decoration-sonar/60 decoration-2 underline-offset-4 hover:underline"
                        >
                          <IconMapPin
                            aria-hidden
                            size={20}
                            className={cn("mt-0.5 shrink-0", on ? "text-sonar" : "text-muted")}
                          />
                          <span>
                            <span className="sr-only">Show </span>
                            {r.placeLabel}
                            <span className="sr-only"> on the map</span>
                          </span>
                        </button>
                        {r.includesSimulated && (
                          <span className="ml-6 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-background sm:ml-0">
                            Simulated
                          </span>
                        )}
                      </div>
                      <p className="mt-1 ml-6 hidden text-sm text-muted sm:block">{whyLine(r)}</p>
                    </th>
                    <td className={td}>{CATEGORY_NAMES[r.category]}</td>
                    <td className={cn(td, "text-muted")}>{r.whoFixesIt}</td>
                    <td className={td}>
                      <SeverityChip severity={r.worstSeverity} />
                    </td>
                    <td className={cn(td, "text-right font-mono tabular-nums")}>{r.reporters}</td>
                    <td className={cn(td, "text-right font-mono tabular-nums")}>
                      {r.nearMisses.toLocaleString("en-CA")}
                    </td>
                    <td className={cn(td, "whitespace-nowrap text-muted")}>{seenAgo(r.lastSeen)}</td>
                    <td className={td}>
                      <span className="flex items-center gap-3">
                        <span className="w-12 text-right font-mono text-lg font-medium tabular-nums">
                          {r.score.toFixed(1)}
                        </span>
                        <span aria-hidden className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                          <span
                            className="block h-full rounded-full bg-sonar"
                            style={{ width: `${Math.max(6, (r.score / top) * 100)}%` }}
                          />
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// The selected cell: what happened there, and the rule each report likely breaks. With nothing
// selected it says how to pick one. It takes focus when closed, so keyboard users don't lose their place.
export function CellCard({
  cell,
  row,
  queue,
  onClose,
}: {
  cell: string | null;
  row: CellRow | undefined;
  queue: QueueRow[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const spots = cell ? queue.filter((q) => q.cell === cell) : [];

  if (!cell) {
    return (
      <section ref={ref} tabIndex={-1} aria-labelledby="cell-card" className={cn(CARD, "p-4 outline-none sm:p-6")}>
        <h2 id="cell-card" className="flex items-center gap-2.5 text-xl font-bold">
          <IconPointer aria-hidden size={24} className="text-sonar" />
          Pick a spot
        </h2>
        <p className="mt-2 text-muted">
          Choose a place in the fix-first queue, a Check now item or a bar on the map. Its score, the rules it likely
          breaks and who fixes it show here.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="cell-card"
      className={cn(
        CARD,
        "border-sonar/45 p-4 shadow-[0_0_60px_-18px_rgb(56_189_248/0.45)] outline-none sm:p-6 contrast-more:shadow-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium tracking-[0.18em] text-sonar uppercase">Selected spot</p>
          <h2 id="cell-card" className="mt-1 text-xl font-bold sm:text-2xl">
            {spots[0]?.placeLabel ?? `Cell ${cell}`}
          </h2>
        </div>
        <Button
          variant="secondary"
          className="min-h-11 shrink-0 px-4"
          onClick={() => {
            onClose();
            ref.current?.focus();
          }}
        >
          <IconX aria-hidden size={20} />
          Close
        </Button>
      </div>
      {row && (
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            ["Events", row.events],
            ["Near-misses", row.nearMisses],
            ["Reports", row.reports],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse rounded-2xl bg-abyss/70 px-3 py-2 ring-1 ring-line">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-mono text-xl font-medium tabular-nums">{Number(value).toLocaleString("en-CA")}</dd>
            </div>
          ))}
        </dl>
      )}
      {row && <p className="mt-2 text-sm text-muted">In this time window.</p>}
      {spots.map((s) => {
        const rules = CATEGORY_RULES[s.category];
        return (
          <div key={s.category} className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
            <p className="flex flex-wrap items-center gap-2 font-bold">
              {CATEGORY_NAMES[s.category]}
              <SeverityChip severity={s.worstSeverity} />
            </p>
            <p className="text-muted">{whyLine(s)}</p>
            <p className="rounded-xl bg-abyss/70 px-3 py-2 font-mono text-sm text-foreground/90 ring-1 ring-line">
              Score {s.score.toFixed(1)} = {s.parts.severityWeight} × {s.parts.reporters.toFixed(2)} ×{" "}
              {s.parts.nearMissPressure.toFixed(2)} × {s.parts.recency.toFixed(2)} × {s.parts.transit}
            </p>
            {rules.rules.map((id) => (
              <p key={id} className="flex gap-2 text-base">
                <IconScale aria-hidden size={20} className="mt-0.5 shrink-0 text-sonar" />
                <span>
                  Likely breaks: {RULES[id].rule} ({RULES[id].source}).
                </span>
              </p>
            ))}
            <p className="text-base">
              <span className="font-semibold">{s.whoFixesIt}.</span>{" "}
              <span className="text-muted">Report it through: {rules.channel311}.</span>
            </p>
          </div>
        );
      })}
      {spots.length === 0 && <p className="mt-4 text-muted">No spot here is in the queue.</p>}
    </section>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-base text-muted">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-full sm:w-auto">Fix-first score</span>
        <span className="font-mono text-sm">low</span>
        <span aria-hidden className="flex overflow-hidden rounded-full ring-1 ring-line">
          {SCORE_COLOURS.map((c) => (
            <span key={c} className="h-3 w-7" style={{ background: c }} />
          ))}
        </span>
        <span className="font-mono text-sm">high</span>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-7 rounded-full" style={{ background: NO_REPORT_COLOUR }} />
        <span>No reports yet (taller and lighter is busier)</span>
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-3.5 rounded-full border-2 border-sonar" />
        <span>New report</span>
      </div>
    </div>
  );
}

export function Feed({
  rows,
  fresh,
  load,
  className,
}: {
  rows: FeedRow[];
  fresh: ReadonlySet<string>;
  load: Load;
  className?: string;
}) {
  return (
    <section aria-labelledby="feed" className={cn(CARD, "flex flex-col p-4 sm:p-6", className)}>
      <PanelHeading id="feed" icon={IconActivity} title="Live feed" note="The latest 20 reports, newest first." />
      {rows.length === 0 && <Empty load={load}>No reports yet.</Empty>}
      <div
        tabIndex={rows.length > 0 ? 0 : undefined}
        role={rows.length > 0 ? "region" : undefined}
        aria-label={rows.length > 0 ? "Live feed list, scrolls" : undefined}
        className={cn("-mx-2 mt-4 max-h-[38rem] overflow-y-auto px-2", rows.length === 0 && "hidden")}
      >
        <ul
          aria-live="polite"
          className="relative flex flex-col gap-2 before:absolute before:top-3 before:bottom-3 before:left-[0.95rem] before:w-px before:bg-line"
        >
          <AnimatePresence initial={false}>
            {rows.map((r) => {
              const key = feedKey(r);
              const isNew = fresh.has(key);
              return (
                <motion.li
                  key={key}
                  layout
                  initial={{ opacity: 0, y: -18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="relative flex gap-3 pl-1"
                >
                  <span className="relative mt-4 flex size-6 shrink-0 items-center justify-center">
                    {isNew && <SonarRings className="-inset-3" count={2} duration={1.6} />}
                    <span
                      className={cn(
                        "size-2.5 rounded-full ring-4 ring-background",
                        isNew ? "bg-sonar" : "bg-slate-400/70",
                      )}
                    />
                  </span>
                  <div
                    className={cn(
                      "min-w-0 flex-1 rounded-2xl border p-3 transition-colors duration-1000",
                      isNew ? "border-sonar/60 bg-sonar/10" : "border-line bg-abyss/50",
                    )}
                  >
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <time dateTime={r.time} className="font-mono text-sm text-muted">
                        {timeOfDay(r.time)}
                      </time>
                      <span className="font-bold">{CATEGORY_NAMES[r.category]}</span>
                      {isNew && <span className="text-sm font-bold text-sonar">New</span>}
                    </p>
                    <p className="mt-1 text-foreground/90">&ldquo;{r.description}&rdquo;</p>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <span className="inline-flex items-center gap-1">
                        <IconMapPin aria-hidden size={16} />
                        {r.placeLabel}
                      </span>
                      <SeverityChip severity={r.severity} />
                      <SourceBadge source={r.source} />
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}

export function feedKey(r: FeedRow): string {
  return `${r.time}-${r.cell}-${r.category}`;
}

function TimingBar({ label, ms, max, strong }: { label: string; ms: number; max: number; strong?: boolean }) {
  const still = useStill();
  const width = `${Math.max(1.5, (ms / max) * 100)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-base", strong ? "font-semibold text-foreground" : "text-muted")}>{label}</span>
        <span className="font-mono text-xl font-medium tabular-nums">
          {ms.toFixed(1)} <span className="text-base text-muted">ms</span>
        </span>
      </div>
      <div aria-hidden className="mt-2 h-3 overflow-hidden rounded-full bg-white/5 ring-1 ring-line">
        <motion.div
          className={cn(
            "h-full min-w-2 rounded-full",
            strong ? "bg-sonar shadow-[0_0_16px_rgb(56_189_248/0.8)] contrast-more:shadow-none" : "bg-slate-400/60",
          )}
          initial={still ? false : { width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
    </div>
  );
}

export function PerfPanel({
  perf,
  load,
  measuring,
  onMeasure,
  className,
}: {
  perf: PerfSnapshot | null;
  load: Load;
  measuring: boolean;
  onMeasure: () => void;
  className?: string;
}) {
  const max = perf ? Math.max(perf.rawMs, perf.aggregateMs, 0.1) : 1;
  return (
    <section aria-labelledby="perf" className={cn(CARD, "flex flex-col p-4 sm:p-6", className)}>
      <PanelHeading
        id="perf"
        icon={IconGauge}
        title="Performance"
        note="Tiger Data: the same question, asked two ways."
      />
      {perf ? (
        <>
          <div className="mt-5 flex flex-col gap-4">
            <TimingBar label="Raw hypertable" ms={perf.rawMs} max={max} />
            <TimingBar label="Continuous aggregate" ms={perf.aggregateMs} max={max} strong />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3">
            {perf.aggregateMs > 0 && (
              <div className="col-span-2 flex flex-col-reverse rounded-2xl bg-sonar/10 px-4 py-3 ring-1 ring-sonar/30">
                <dt className="text-base text-muted">faster from the continuous aggregate</dt>
                <dd className="font-mono text-4xl font-medium text-sonar tabular-nums">
                  {(perf.rawMs / perf.aggregateMs).toFixed(1)}×
                </dd>
              </div>
            )}
            <div className="flex flex-col-reverse rounded-2xl bg-abyss/70 px-4 py-3 ring-1 ring-line">
              <dt className="text-sm text-muted">Compressed chunks</dt>
              <dd className="font-mono text-xl font-medium tabular-nums">
                {perf.compressionRatio === null ? "none yet" : `${perf.compressionRatio.toFixed(1)}× smaller`}
              </dd>
            </div>
            <div className="flex flex-col-reverse rounded-2xl bg-abyss/70 px-4 py-3 ring-1 ring-line">
              <dt className="text-sm text-muted">Rows</dt>
              <dd className="font-mono text-xl font-medium tabular-nums">{perf.totalRows.toLocaleString("en-CA")}</dd>
            </div>
          </dl>
          <p className="mt-4 text-base text-muted">
            Same question both times: events and near-misses per cell over the last 7 days, timed by the database.
            {perf.seedLoadSeconds !== null && ` Seed loaded in ${perf.seedLoadSeconds.toFixed(1)} s.`} Measured at{" "}
            <span className="font-mono whitespace-nowrap">{timeOfDay(perf.takenAt)}</span>
            {timeOfDay(perf.takenAt).endsWith(".") ? "" : "."}
          </p>
        </>
      ) : (
        <Empty load={load}>No measurement yet.</Empty>
      )}
      <div className="mt-5">
        <Button onClick={onMeasure} disabled={measuring}>
          <IconRefresh aria-hidden size={20} className={cn(measuring && "motion-safe:animate-spin")} />
          {measuring ? "Measuring" : "Measure again"}
        </Button>
      </div>
    </section>
  );
}
