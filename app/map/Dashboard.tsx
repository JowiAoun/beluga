"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type {
  CellsResponse,
  FeedResponse,
  PerfResponse,
  QueueResponse,
  StationsResponse,
  UrgentResponse,
} from "@/lib/shared/contracts";
import {
  CIVIC_CATEGORIES,
  DASHBOARD_WINDOWS,
  type CivicCategory,
  type DashboardWindow,
  type SourceFilter,
} from "@/lib/shared/enums";
import { DASHBOARD } from "@/lib/shared/params";
import { CATEGORY_NAMES, NO_REPORT_COLOUR, SCORE_COLOURS } from "./format";
import { CellCard, CheckNow, Feed, feedKey, PerfPanel, QueueTable } from "./Panels";
import AskData from "./AskData";
import StationPanels from "./StationPanels";
import { usePoll } from "./usePoll";

// MapLibre needs the browser.
const CellMap = dynamic(() => import("./CellMap"), {
  ssr: false,
  loading: () => <div className="h-[28rem] w-full rounded-lg bg-neutral-900" />,
});

const WINDOW_NAMES: Record<DashboardWindow, string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "14d": "14 days",
};
const SOURCE_NAMES: Record<SourceFilter, string> = { live: "Live", simulated: "Simulated", both: "Both" };
// New reports stay highlighted this long.
const FLASH_MS = 4000;

export default function Dashboard() {
  const [window, setWindow] = useState<DashboardWindow>("24h");
  const [source, setSource] = useState<SourceFilter>("both");
  const [category, setCategory] = useState<CivicCategory | "all">("all");
  const [station, setStation] = useState("rideau");
  const [selected, setSelected] = useState<string | null>(null);
  const [measureCount, setMeasureCount] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [measured, setMeasured] = useState<PerfResponse | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);

  const query = new URLSearchParams({ window, source, ...(category === "all" ? {} : { category }) }).toString();
  const queue = usePoll<QueueResponse>(`/api/dashboard/queue?${query}`, DASHBOARD.feedAndQueuePollMs);
  const urgent = usePoll<UrgentResponse>(`/api/dashboard/urgent?${query}`, DASHBOARD.feedAndQueuePollMs);
  const feed = usePoll<FeedResponse>(`/api/dashboard/feed?${query}`, DASHBOARD.feedAndQueuePollMs);
  const cells = usePoll<CellsResponse>(`/api/dashboard/cells?${query}`, DASHBOARD.cellsAndStationsPollMs);
  const stations = usePoll<StationsResponse>(
    `/api/dashboard/stations?${query}&station=${station}`,
    DASHBOARD.cellsAndStationsPollMs,
  );
  const loadedPerf = usePoll<PerfResponse>(`/api/dashboard/perf?${query}`, null, measureCount);
  const perf = measured ?? loadedPerf.data;

  // Reports that weren't there on the last poll flash in the feed and on the map.
  useEffect(() => {
    const rows = feed.data?.rows;
    if (!rows) return;
    const keys = rows.map(feedKey);
    const seen = seenRef.current;
    seenRef.current = new Set([...(seen ?? []), ...keys]);
    if (!seen) return;
    const added = keys.filter((k) => !seen.has(k));
    if (added.length === 0) return;
    const show = setTimeout(() => setFresh(new Set(added)), 0);
    const hide = setTimeout(() => setFresh(new Set()), FLASH_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [feed.data]);

  const measure = async () => {
    setMeasuring(true);
    try {
      const response = await fetch("/api/dashboard/perf", { method: "POST" });
      if (response.ok) setMeasured((await response.json()) as PerfResponse);
    } finally {
      setMeasuring(false);
      setMeasureCount((n) => n + 1);
    }
  };

  const simulated = [queue, urgent, feed, cells, stations].some((p) => p.data?.includesSimulated);
  const error = [queue, cells, feed].find((p) => p.error)?.error;
  const freshCells = new Set((feed.data?.rows ?? []).filter((r) => fresh.has(feedKey(r))).map((r) => r.cell));
  const cellRows = cells.data?.rows ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">beluga for cities</h1>
            <p className="opacity-80">
              What to fix first around Ottawa&apos;s O-Train stations, from anonymous reports by blind and low-vision
              pedestrians.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col text-sm">
              Time window
              <select
                value={window}
                onChange={(e) => setWindow(e.target.value as DashboardWindow)}
                className="min-h-10 rounded bg-neutral-800 px-2"
              >
                {DASHBOARD_WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {WINDOW_NAMES[w]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CivicCategory | "all")}
                className="min-h-10 rounded bg-neutral-800 px-2"
              >
                <option value="all">All categories</option>
                {CIVIC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_NAMES[c]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col text-sm">
              <legend>Data</legend>
              <div className="flex overflow-hidden rounded border border-neutral-600">
                {(Object.keys(SOURCE_NAMES) as SourceFilter[]).map((s) => (
                  <label
                    key={s}
                    className={`min-h-10 cursor-pointer px-3 py-2 ${source === s ? "bg-yellow-300 text-black" : ""}`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={s}
                      checked={source === s}
                      onChange={() => setSource(s)}
                      className="sr-only"
                    />
                    {SOURCE_NAMES[s]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
        {simulated && (
          <p role="note" className="rounded bg-yellow-300 px-3 py-2 font-semibold text-black">
            Demo data: simulated events for illustration, not real incidents.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded bg-red-900 px-3 py-2">
            The database isn&apos;t answering ({error}). Showing the last numbers it gave.
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <CheckNow rows={urgent.data?.rows ?? []} />
          <QueueTable rows={queue.data?.rows ?? []} selected={selected} onSelect={setSelected} />
        </div>
        <div className="flex flex-col gap-2">
          <CellMap cells={cellRows} selected={selected} flashing={freshCells} onSelect={setSelected} />
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Fix-first score, low to high:
            {SCORE_COLOURS.map((c) => (
              <span key={c} className="inline-block h-3 w-6 rounded-sm" style={{ background: c }} aria-hidden="true" />
            ))}
            <span
              className="ml-2 inline-block h-3 w-6 rounded-sm"
              style={{ background: NO_REPORT_COLOUR }}
              aria-hidden="true"
            />
            no reports (darker is busier)
          </p>
          {selected && (
            <CellCard
              cell={selected}
              row={cellRows.find((c) => c.cell === selected)}
              queue={queue.data?.rows ?? []}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>

      <AskData />
      <StationPanels data={stations.data} selected={station} onSelect={setStation} />
      <Feed rows={feed.data?.rows ?? []} fresh={fresh} />
      <PerfPanel perf={perf?.latest ?? null} measuring={measuring} onMeasure={() => void measure()} />
    </div>
  );
}
