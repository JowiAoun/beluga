"use client";

import { IconBuildingCommunity, IconDatabaseOff, IconFlask, IconMap2 } from "@tabler/icons-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CARD } from "@/components/brand/Card";
import { LiveContours } from "@/components/brand/LiveContours";
import { DISPLAY, Eyebrow, Name, Serif } from "@/components/brand/Display";
import { SonarRings } from "@/components/brand/SonarRings";
import type {
  CellsResponse,
  FeedResponse,
  PerfResponse,
  QueueResponse,
  StationsResponse,
  UrgentResponse,
} from "@/lib/shared/contracts";
import type { CivicCategory, DashboardWindow, SourceFilter } from "@/lib/shared/enums";
import { DASHBOARD } from "@/lib/shared/params";
import { cn } from "@/lib/utils";
import AskData from "./AskData";
import { Filters } from "./Filters";
import { WINDOW_NAMES } from "./format";
import { CellCard, CheckNow, Feed, feedKey, MapLegend, PanelHeading, PerfPanel, QueueTable } from "./Panels";
import StationPanels from "./StationPanels";
import { Stats } from "./Stats";
import { loadOf, usePoll } from "./usePoll";

function MapLoading() {
  return (
    <div className="relative isolate flex h-[60svh] min-h-80 w-full items-center justify-center overflow-hidden bg-abyss ring-1 ring-line lg:h-[36rem]">
      <LiveContours variant="b" />
      <span className="relative flex size-20 items-center justify-center">
        <SonarRings className="inset-0" count={3} />
        <span className="size-2.5 rounded-full bg-sonar" />
      </span>
      <p className="absolute bottom-6 text-muted">Loading the map</p>
    </div>
  );
}

// MapLibre needs the browser.
const CellMap = dynamic(() => import("./CellMap"), { ssr: false, loading: MapLoading });

// New reports stay highlighted this long.
const FLASH_MS = 4000;

const OFFLINE_WORDS: Record<string, string> = {
  database_unavailable: "The hazard database isn't answering right now.",
  not_configured: "This server has no database set up yet.",
  offline: "This browser can't reach the server.",
};

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

  // Reports that weren't there on the last poll flash in the feed and ring on the map.
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
  const stale = Boolean(queue.data || cells.data || feed.data);
  const freshCells = new Set((feed.data?.rows ?? []).filter((r) => fresh.has(feedKey(r))).map((r) => r.cell));
  const cellRows = cells.data?.rows ?? [];
  const queueRows = queue.data?.rows ?? [];
  const cellsLoad = loadOf(cells);
  const selectedPlace = selected && (queueRows.find((q) => q.cell === selected)?.placeLabel ?? `cell ${selected}`);

  return (
    <main id="main" tabIndex={-1} className="relative isolate overflow-x-clip outline-none">
      <div className="tone-dark relative isolate border-b border-line">
        <LiveContours variant="a" />
        <header className="relative mx-auto flex max-w-[90rem] flex-col gap-6 px-4 pt-28 pb-10 sm:px-6 md:pt-32 md:pb-12">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="max-w-4xl">
              <Eyebrow icon={<IconBuildingCommunity aria-hidden size={20} />}>For the city</Eyebrow>
              <h1 className={cn(DISPLAY, "mt-4 text-section")}>
                <Name /> for <Serif>cities</Serif>
              </h1>
              <p className="mt-5 max-w-[65ch] text-lg text-muted">
                What to fix first around Ottawa&apos;s O-Train stations, from anonymous reports by blind and low-vision
                pedestrians.
              </p>
            </div>
            <p className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-background px-4 py-2 text-base font-semibold text-muted">
              <span className="relative flex size-2.5" aria-hidden>
                {!error && cellsLoad === "ready" && (
                  <span className="absolute inline-flex size-full rounded-full bg-sonar opacity-75 motion-safe:animate-ping" />
                )}
                <span className={cn("relative inline-flex size-2.5 rounded-full", error ? "bg-muted" : "bg-sonar")} />
              </span>
              {error ? "Offline, trying again every 5 s" : "Live, updates every 5 s"}
            </p>
          </div>

          <Filters
            window={window}
            category={category}
            source={source}
            onWindow={setWindow}
            onCategory={setCategory}
            onSource={setSource}
          />

          {simulated && (
            <p
              role="note"
              className="flex items-start gap-3 rounded-md bg-accent px-4 py-3 text-lg font-semibold text-on-accent"
            >
              <IconFlask aria-hidden size={24} className="mt-0.5 shrink-0" />
              Demo data: simulated events for illustration, not real incidents.
            </p>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-4 border border-line-strong bg-surface p-4 sm:p-5">
              <span className="relative mt-1 flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-abyss">
                <SonarRings className="-inset-4" count={3} />
                <IconDatabaseOff aria-hidden size={24} className="text-sonar" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold">Waiting for the database</p>
                <p className="mt-1 max-w-[65ch] text-muted">
                  {OFFLINE_WORDS[error] ?? `The server couldn't answer (${error}).`} The dashboard asks again every 5
                  seconds and fills in by itself.
                  {stale && " Until then it shows the last numbers it gave."}
                </p>
                <p className="mt-2 font-mono text-sm text-muted">Server said: {error}</p>
              </div>
            </div>
          )}
        </header>
      </div>

      <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-4 pt-8 pb-24 sm:px-6 md:pt-10">
        <Stats
          cells={cells.data?.rows ?? null}
          queue={queue.data?.rows ?? null}
          perf={perf?.latest ?? null}
          cellsLoad={cellsLoad}
          queueLoad={loadOf(queue)}
          perfLoad={measured ? "ready" : loadOf(loadedPerf)}
          windowName={WINDOW_NAMES[window]}
        />

        <p aria-live="polite" className="sr-only">
          {selectedPlace ? `Showing ${selectedPlace} on the map. Its details are next to the map.` : ""}
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section aria-labelledby="map-title" className={cn(CARD, "flex flex-col gap-4 p-3 sm:p-5 lg:col-span-8")}>
            <div className="px-1 pt-1 sm:p-0">
              <PanelHeading
                id="map-title"
                icon={IconMap2}
                title="Hazard map"
                note="Each bar is one grid cell, about 100 m across. Taller and brighter bars score higher on the fix-first list."
              />
            </div>
            <CellMap
              cells={cellRows}
              selected={selected}
              flashing={freshCells}
              onSelect={setSelected}
              emptyNote={
                cellRows.length > 0
                  ? null
                  : cellsLoad === "offline"
                    ? "The bars come in when the database answers."
                    : cellsLoad === "ready"
                      ? "No reports in this window."
                      : null
              }
            />
            <div className="px-1 pb-1 sm:p-0">
              <MapLegend />
            </div>
          </section>

          <div className="flex flex-col gap-6 lg:col-span-4">
            <CheckNow rows={urgent.data?.rows ?? []} load={loadOf(urgent)} selected={selected} onSelect={setSelected} />
            <CellCard
              cell={selected}
              row={cellRows.find((c) => c.cell === selected)}
              queue={queueRows}
              onClose={() => setSelected(null)}
            />
          </div>

          <QueueTable
            rows={queueRows}
            load={loadOf(queue)}
            selected={selected}
            onSelect={setSelected}
            className="lg:col-span-12"
          />
          <Feed rows={feed.data?.rows ?? []} fresh={fresh} load={loadOf(feed)} className="lg:col-span-5" />
          <StationPanels
            data={stations.data}
            load={loadOf(stations)}
            selected={station}
            onSelect={setStation}
            className="lg:col-span-7"
          />
          <PerfPanel
            perf={perf?.latest ?? null}
            load={measured ? "ready" : loadOf(loadedPerf)}
            measuring={measuring}
            onMeasure={() => void measure()}
            className="lg:col-span-5"
          />
          <AskData className="lg:col-span-7" />
        </div>
      </div>
    </main>
  );
}
