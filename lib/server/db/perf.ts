import "server-only";

// Tiger Data prize: the performance panel's numbers. The same question, "events and near-misses
// per cell over the last 7 days", timed by the database itself on the raw hypertable and on the
// cell_15m continuous aggregate, plus the columnstore's compression and the row count.

import type postgres from "postgres";
import type { PerfSnapshot } from "@/lib/shared/contracts";

const RAW = `
  select cell, count(*) as events, count(*) filter (where event_kind = 'near_miss') as near_misses
  from hazard_events
  where time > now() - interval '7 days'
  group by cell`;

const AGGREGATE = `
  select cell, sum(events) as events, sum(near_misses) as near_misses
  from cell_15m
  where bucket > now() - interval '7 days'
  group by cell`;

// The execution time the database measured, without the network.
async function executionMs(sql: postgres.Sql, query: string): Promise<number> {
  const rows = await sql.unsafe<Array<{ "QUERY PLAN": Array<{ "Execution Time": number }> }>>(
    `explain (analyze, format json) ${query}`,
  );
  return rows[0]["QUERY PLAN"][0]["Execution Time"];
}

interface SnapshotRow {
  taken_at: Date;
  raw_ms: number;
  aggregate_ms: number;
  compressed_bytes: string | null;
  uncompressed_bytes: string | null;
  total_rows: string;
  seed_load_seconds: number | null;
  notes: string | null;
}

export function toSnapshot(row: SnapshotRow): PerfSnapshot {
  const compressed = row.compressed_bytes === null ? null : Number(row.compressed_bytes);
  const uncompressed = row.uncompressed_bytes === null ? null : Number(row.uncompressed_bytes);
  return {
    takenAt: row.taken_at.toISOString(),
    rawMs: row.raw_ms,
    aggregateMs: row.aggregate_ms,
    compressedBytes: compressed,
    uncompressedBytes: uncompressed,
    compressionRatio: compressed && uncompressed ? uncompressed / compressed : null,
    totalRows: Number(row.total_rows),
    seedLoadSeconds: row.seed_load_seconds,
    notes: row.notes,
  };
}

// Measures, stores the snapshot in perf_snapshots and returns it. Each query runs twice and the
// second time counts, so a cold cache doesn't decide the comparison.
export async function measurePerf(sql: postgres.Sql, seedLoadSeconds: number | null = null): Promise<PerfSnapshot> {
  await executionMs(sql, RAW);
  const rawMs = await executionMs(sql, RAW);
  await executionMs(sql, AGGREGATE);
  const aggregateMs = await executionMs(sql, AGGREGATE);
  const [stats] = await sql<Array<{ before: string | null; after: string | null }>>`
    select sum(before_compression_total_bytes)::bigint as before, sum(after_compression_total_bytes)::bigint as after
    from hypertable_compression_stats('hazard_events')`;
  const [count] = await sql<Array<{ n: string }>>`select count(*)::bigint as n from hazard_events`;
  const [row] = await sql<SnapshotRow[]>`
    insert into perf_snapshots (raw_ms, aggregate_ms, compressed_bytes, uncompressed_bytes, total_rows, seed_load_seconds)
    values (${rawMs}, ${aggregateMs}, ${stats?.after ?? null}, ${stats?.before ?? null}, ${count.n},
      ${seedLoadSeconds ?? (await lastSeedLoad(sql))})
    returning *`;
  return toSnapshot(row);
}

async function lastSeedLoad(sql: postgres.Sql): Promise<number | null> {
  const [row] = await sql<Array<{ s: number | null }>>`
    select seed_load_seconds as s from perf_snapshots where seed_load_seconds is not null order by taken_at desc limit 1`;
  return row?.s ?? null;
}

export async function latestPerf(sql: postgres.Sql): Promise<PerfSnapshot | null> {
  const [row] = await sql<SnapshotRow[]>`select * from perf_snapshots order by taken_at desc limit 1`;
  return row ? toSnapshot(row) : null;
}
