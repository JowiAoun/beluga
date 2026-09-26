"use client";

import type { CellRow, FeedRow, PerfSnapshot, QueueRow, UrgentRow } from "@/lib/shared/contracts";
import { CATEGORY_RULES, RULES } from "@/lib/shared/reporting";
import { CATEGORY_NAMES, seenAgo, timeOfDay, whyLine } from "./format";

function SourceBadge({ source }: { source: "live" | "simulated" }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${source === "live" ? "bg-emerald-800 text-white" : "bg-yellow-300 text-black"}`}
    >
      {source === "live" ? "Live" : "Simulated"}
    </span>
  );
}

// Severity 4: the spots to check today, by cell and day only.
export function CheckNow({ rows }: { rows: UrgentRow[] }) {
  return (
    <section aria-labelledby="check-now" className="rounded-lg border-2 border-red-500 p-3">
      <h2 id="check-now" className="text-lg font-bold">
        Check now <span className="font-normal">(severity 4: a fall risk)</span>
      </h2>
      {rows.length === 0 ? (
        <p className="opacity-80">Nothing at severity 4 in the last 14 days.</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {rows.map((r) => (
            <li key={`${r.cell}-${r.category}-${r.day}-${r.source}`} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{CATEGORY_NAMES[r.category]}</span>
              <span>{r.placeLabel}</span>
              <span className="opacity-80">
                {r.day}, {r.whoFixesIt}
              </span>
              <SourceBadge source={r.source} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QueueTable({
  rows,
  selected,
  onSelect,
}: {
  rows: QueueRow[];
  selected: string | null;
  onSelect: (cell: string) => void;
}) {
  return (
    <section aria-labelledby="fix-first">
      <h2 id="fix-first" className="text-lg font-bold">
        Fix-first queue <span className="font-normal opacity-80">(last 14 days, 3 or more reporters)</span>
      </h2>
      {rows.length === 0 ? (
        <p className="opacity-80">No spot has 3 reporters yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-neutral-600 text-xs uppercase opacity-80">
              <tr>
                <th scope="col" className="py-1 pr-2">
                  #
                </th>
                <th scope="col" className="pr-2">
                  Place
                </th>
                <th scope="col" className="pr-2">
                  Category
                </th>
                <th scope="col" className="pr-2">
                  Who fixes it
                </th>
                <th scope="col" className="pr-2">
                  Severity
                </th>
                <th scope="col" className="pr-2">
                  Reporters
                </th>
                <th scope="col" className="pr-2">
                  Near-misses
                </th>
                <th scope="col" className="pr-2">
                  Last seen
                </th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.cell}-${r.category}`}
                  className={`border-b border-neutral-800 align-top ${selected === r.cell ? "bg-neutral-800" : ""}`}
                >
                  <td className="py-1 pr-2">{i + 1}</td>
                  <td className="pr-2">
                    <button
                      type="button"
                      onClick={() => onSelect(r.cell)}
                      className="text-left font-semibold underline decoration-dotted"
                    >
                      {r.placeLabel}
                    </button>
                    {r.includesSimulated && <span className="ml-1 text-xs text-yellow-300">sim</span>}
                    <div className="text-xs opacity-80">{whyLine(r)}</div>
                  </td>
                  <td className="pr-2">{CATEGORY_NAMES[r.category]}</td>
                  <td className="pr-2">{r.whoFixesIt}</td>
                  <td className="pr-2">{r.worstSeverity}</td>
                  <td className="pr-2">{r.reporters}</td>
                  <td className="pr-2">{r.nearMisses.toLocaleString("en-CA")}</td>
                  <td className="pr-2">{seenAgo(r.lastSeen)}</td>
                  <td>{r.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// The selected cell: what happened there, and the rule each report likely breaks.
export function CellCard({
  cell,
  row,
  queue,
  onClose,
}: {
  cell: string;
  row: CellRow | undefined;
  queue: QueueRow[];
  onClose: () => void;
}) {
  const spots = queue.filter((q) => q.cell === cell);
  return (
    <section aria-labelledby="cell-card" className="rounded-lg border border-neutral-600 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 id="cell-card" className="text-lg font-bold">
          {spots[0]?.placeLabel ?? `Cell ${cell}`}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-500 px-2"
          aria-label="Close the cell card"
        >
          Close
        </button>
      </div>
      {row && (
        <p className="tabular-nums">
          {row.events.toLocaleString("en-CA")} events, {row.nearMisses.toLocaleString("en-CA")} near-misses,{" "}
          {row.reports} reports in this window
        </p>
      )}
      {spots.map((s) => {
        const rules = CATEGORY_RULES[s.category];
        return (
          <div key={s.category} className="mt-2 flex flex-col gap-1">
            <p className="font-semibold">
              {CATEGORY_NAMES[s.category]}, severity {s.worstSeverity}: {whyLine(s)}
            </p>
            <p className="text-sm tabular-nums opacity-80">
              Score {s.score.toFixed(1)} = {s.parts.severityWeight} × {s.parts.reporters.toFixed(2)} ×{" "}
              {s.parts.nearMissPressure.toFixed(2)} × {s.parts.recency.toFixed(2)} × {s.parts.transit}
            </p>
            {rules.rules.map((id) => (
              <p key={id} className="text-sm">
                Likely breaks: {RULES[id].rule} ({RULES[id].source}).
              </p>
            ))}
            <p className="text-sm">
              {s.whoFixesIt}. Report it through: {rules.channel311}.
            </p>
          </div>
        );
      })}
      {spots.length === 0 && <p className="opacity-80">No spot here is in the queue.</p>}
    </section>
  );
}

export function Feed({ rows, fresh }: { rows: FeedRow[]; fresh: ReadonlySet<string> }) {
  return (
    <section aria-labelledby="feed">
      <h2 id="feed" className="text-lg font-bold">
        Live feed
      </h2>
      <ul className="flex flex-col gap-1" aria-live="polite">
        {rows.map((r) => {
          const key = feedKey(r);
          return (
            <li
              key={key}
              className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 transition-colors duration-1000 ${fresh.has(key) ? "bg-yellow-300/30" : ""}`}
            >
              <span className="tabular-nums opacity-80">{timeOfDay(r.time)}</span>
              <span className="font-semibold">{CATEGORY_NAMES[r.category]}</span>
              <span>severity {r.severity}</span>
              <span className="opacity-90">&ldquo;{r.description}&rdquo;</span>
              <span className="opacity-80">{r.placeLabel}</span>
              <SourceBadge source={r.source} />
            </li>
          );
        })}
        {rows.length === 0 && <li className="opacity-80">No reports yet.</li>}
      </ul>
    </section>
  );
}

export function feedKey(r: FeedRow): string {
  return `${r.time}-${r.cell}-${r.category}`;
}

export function PerfPanel({
  perf,
  measuring,
  onMeasure,
}: {
  perf: PerfSnapshot | null;
  measuring: boolean;
  onMeasure: () => void;
}) {
  return (
    <section aria-labelledby="perf" className="rounded-lg border border-neutral-600 p-3">
      <h2 id="perf" className="text-lg font-bold">
        Performance: Tiger Data
      </h2>
      {perf ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase opacity-80">Raw hypertable</dt>
            <dd className="text-2xl font-bold">{perf.rawMs.toFixed(1)} ms</dd>
          </div>
          <div>
            <dt className="text-xs uppercase opacity-80">Continuous aggregate</dt>
            <dd className="text-2xl font-bold">
              {perf.aggregateMs.toFixed(1)} ms
              {perf.aggregateMs > 0 && (
                <span className="ml-1 text-sm font-normal">({(perf.rawMs / perf.aggregateMs).toFixed(1)}× faster)</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase opacity-80">Compressed chunks</dt>
            <dd className="text-2xl font-bold">
              {perf.compressionRatio === null ? "none yet" : `${perf.compressionRatio.toFixed(1)}× smaller`}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase opacity-80">Rows</dt>
            <dd className="text-2xl font-bold">{perf.totalRows.toLocaleString("en-CA")}</dd>
          </div>
          <p className="col-span-full text-sm opacity-80">
            Same question both times: events and near-misses per cell over the last 7 days, timed by the database.
            {perf.seedLoadSeconds !== null && ` Seed loaded in ${perf.seedLoadSeconds.toFixed(1)} s.`} Measured{" "}
            {timeOfDay(perf.takenAt)}.
          </p>
        </dl>
      ) : (
        <p className="opacity-80">No measurement yet.</p>
      )}
      <button
        type="button"
        onClick={onMeasure}
        disabled={measuring}
        className="mt-2 min-h-12 rounded-lg bg-yellow-300 px-4 font-semibold text-black disabled:opacity-60"
      >
        {measuring ? "Measuring" : "Measure again"}
      </button>
    </section>
  );
}
