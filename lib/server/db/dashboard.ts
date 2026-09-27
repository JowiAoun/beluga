import "server-only";

// Tiger Data prize: the dashboard's reads. Every view but the live feed reads a continuous
// aggregate in real-time mode, so the newest reports show without waiting for a refresh.

import type postgres from "postgres";
import type {
  CellRow,
  CellsResponse,
  FeedResponse,
  QueueResponse,
  StationsResponse,
  UrgentResponse,
} from "@/lib/shared/contracts";
import type { CivicCategory, DashboardWindow, Severity, Source, SourceFilter } from "@/lib/shared/enums";
import { DASHBOARD } from "@/lib/shared/params";
import { ownerFor } from "@/lib/shared/reporting";

export interface Filters {
  window: DashboardWindow;
  source: SourceFilter;
  category: CivicCategory | null;
}

export function sourcesFor(filter: SourceFilter): Source[] {
  return filter === "both" ? ["live", "simulated"] : [filter];
}

const WINDOW_INTERVAL: Record<DashboardWindow, string> = { "1h": "1 hour", "24h": "24 hours", "7d": "7 days", "14d": "14 days" };

function placeLabel(stationName: string | null, cell: string): string {
  return stationName ? `near ${stationName}` : cell;
}

export async function queue(sql: postgres.Sql, filters: Filters): Promise<QueueResponse> {
  const rows = await sql<
    Array<{
      cell: string;
      category: CivicCategory;
      worst_severity: number;
      reporters: string;
      near_misses: string;
      last_report: Date;
      station_id: string | null;
      place: string;
      severity_weight: number;
      reporter_part: number;
      near_miss_part: number;
      recency: number;
      transit: number;
      score: number;
      includes_simulated: boolean;
      lat: number;
      lon: number;
    }>
  >`
    select q.*, st_y(st_pointfromgeohash(q.cell)) as lat, st_x(st_pointfromgeohash(q.cell)) as lon
    from fix_first_for(${sourcesFor(filters.source)}) q
    where ${filters.category}::text is null or q.category = ${filters.category}
    limit ${DASHBOARD.queueLimit}`;
  return {
    includesSimulated: rows.some((r) => r.includes_simulated),
    rows: rows.map((r) => ({
      cell: r.cell,
      placeLabel: r.place,
      lat: r.lat,
      lon: r.lon,
      category: r.category,
      whoFixesIt: ownerFor(r.category, { nearStation: r.station_id !== null, indoor: false }),
      worstSeverity: r.worst_severity as Severity,
      reporters: Number(r.reporters),
      nearMisses: Number(r.near_misses),
      lastSeen: r.last_report.toISOString(),
      score: r.score,
      parts: {
        severityWeight: r.severity_weight,
        reporters: r.reporter_part,
        nearMissPressure: r.near_miss_part,
        recency: r.recency,
        transit: r.transit,
      },
      includesSimulated: r.includes_simulated,
    })),
  };
}

// "Check now": severity 4 in the last 14 days, by cell and day only, with no reporter minimum.
// One row per spot, with the latest day it was reported. The aggregate's days are UTC, so the day
// shown comes from the latest report in Ottawa time: a report at 11 pm is still that evening.
export async function urgent(sql: postgres.Sql, filters: Filters): Promise<UrgentResponse> {
  const rows = await sql<Array<{ cell: string; category: CivicCategory; day: string; source: Source; name: string | null }>>`
    select cell, category, day, source, name from (
      select distinct on (d.cell, d.category, d.source) d.cell, d.category, d.source, n.name, d.last_report,
             to_char(d.last_report at time zone 'America/Toronto', 'YYYY-MM-DD') as day
      from cell_daily d
      left join lateral (
        select s.name from stations s
        where st_dwithin(s.location, st_pointfromgeohash(d.cell)::geography, 150)
        order by s.location <-> st_pointfromgeohash(d.cell)::geography
        limit 1
      ) n on true
      where d.worst_severity = 4 and d.civic_reports > 0
        and d.day >= now() - interval '14 days'
        and d.source = any(${sourcesFor(filters.source)})
        and (${filters.category}::text is null or d.category = ${filters.category})
      order by d.cell, d.category, d.source, d.last_report desc
    ) latest
    order by last_report desc, cell
    limit ${DASHBOARD.queueLimit}`;
  return {
    includesSimulated: rows.some((r) => r.source === "simulated"),
    rows: rows.map((r) => ({
      cell: r.cell,
      placeLabel: placeLabel(r.name, r.cell),
      category: r.category,
      whoFixesIt: ownerFor(r.category, { nearStation: r.name !== null, indoor: false }),
      day: r.day,
      source: r.source,
    })),
  };
}

// Map cells for the window: the 15-minute aggregate for an hour or a day, the daily one beyond.
export async function cells(sql: postgres.Sql, filters: Filters): Promise<CellsResponse> {
  const sources = sourcesFor(filters.source);
  const since = WINDOW_INTERVAL[filters.window];
  const daily = filters.window === "7d" || filters.window === "14d";
  const view = sql(daily ? "cell_daily" : "cell_15m");
  const time = sql(daily ? "day" : "bucket");
  const rows = await sql<
    Array<{ cell: string; events: string; near_misses: string; reports: string; simulated: boolean; score: number | null; lat: number; lon: number }>
  >`
    with totals as (
      select cell, sum(events) as events, sum(near_misses) as near_misses, sum(civic_reports) as reports,
             bool_or(source = 'simulated') as simulated
      from ${view}
      where ${time} >= now() - ${since}::interval
        and source = any(${sources})
        and (${filters.category}::text is null or category = ${filters.category})
      group by cell
    ),
    scores as (select cell, max(score) as score from fix_first_for(${sources}) group by cell)
    select t.*, s.score, st_y(st_pointfromgeohash(t.cell)) as lat, st_x(st_pointfromgeohash(t.cell)) as lon
    from totals t left join scores s using (cell)`;
  return {
    includesSimulated: rows.some((r) => r.simulated),
    rows: rows.map(
      (r): CellRow => ({
        cell: r.cell,
        lat: r.lat,
        lon: r.lon,
        events: Number(r.events),
        nearMisses: Number(r.near_misses),
        reports: Number(r.reports),
        score: r.score,
      }),
    ),
  };
}

// Hourly near-misses per station over 7 days, and the hour-of-day profile (Ottawa time) for one.
export async function stations(sql: postgres.Sql, filters: Filters, stationId: string | null): Promise<StationsResponse> {
  const sources = sourcesFor(filters.source);
  const rows = await sql<Array<{ station_id: string; name: string; hour: Date; near_misses: string; simulated: boolean }>>`
    select h.station_id, s.name, h.bucket as hour, sum(h.near_misses) as near_misses, bool_or(h.source = 'simulated') as simulated
    from station_hourly h join stations s using (station_id)
    where h.bucket >= now() - interval '7 days' and h.source = any(${sources})
    group by 1, 2, 3
    order by 3`;
  const series = new Map<string, StationsResponse["series"][number]>();
  for (const r of rows) {
    let s = series.get(r.station_id);
    if (!s) series.set(r.station_id, (s = { stationId: r.station_id, name: r.name, points: [] }));
    s.points.push({ hour: r.hour.toISOString(), nearMisses: Number(r.near_misses) });
  }
  let profile: StationsResponse["profile"] = null;
  if (stationId) {
    const hours = await sql<Array<{ hour: number; near_misses: string }>>`
      select extract(hour from bucket at time zone 'America/Toronto')::int as hour, sum(near_misses) as near_misses
      from station_hourly
      where station_id = ${stationId} and bucket >= now() - interval '7 days' and source = any(${sources})
      group by 1 order by 1`;
    const byHour = new Map(hours.map((h) => [h.hour, Number(h.near_misses)]));
    profile = { stationId, hours: Array.from({ length: 24 }, (_, hour) => ({ hour, nearMisses: byHour.get(hour) ?? 0 })) };
  }
  return { includesSimulated: rows.some((r) => r.simulated), series: [...series.values()], profile };
}

// The last 20 civic reports, newest first. A small raw read on the (event kind, time) index.
export async function feed(sql: postgres.Sql, filters: Filters): Promise<FeedResponse> {
  const rows = await sql<
    Array<{ time: Date; civic_category: CivicCategory; severity: number; description: string | null; cell: string; name: string | null; source: Source }>
  >`
    select e.time, e.civic_category, e.severity, e.description, e.cell, s.name, e.source
    from hazard_events e left join stations s using (station_id)
    where e.event_kind = 'civic_report'
      and e.source = any(${sourcesFor(filters.source)})
      and (${filters.category}::text is null or e.civic_category = ${filters.category})
    order by e.time desc
    limit ${DASHBOARD.feedLimit}`;
  return {
    includesSimulated: rows.some((r) => r.source === "simulated"),
    rows: rows.map((r) => ({
      time: r.time.toISOString(),
      category: r.civic_category,
      severity: r.severity as Severity,
      description: r.description ?? "",
      placeLabel: placeLabel(r.name, r.cell),
      source: r.source,
      cell: r.cell,
    })),
  };
}
