// Tiger Data prize: Phase 0 smoke test for the Tiger Cloud service.
// It tries every database feature beluga needs (hypertable, stacked real-time
// continuous aggregates, columnstore, retention, PostGIS geohash) on throwaway
// objects, then removes them. If a step fails here, move to the trial service
// now, before Phase 6 is built on top of it.
//
// Run `npm run db:smoke` with DATABASE_URL in `.env.local`.

import postgres from "postgres";
import { databaseUrl } from "./url";
import ngeohash from "ngeohash";

// The free service turns read-only at 750 MB.
const FREE_TIER_MB = 750;
const SIZE_WARNING_SHARE = 0.9;

// uOttawa and Rideau stations, turned into 7-character cells the way the phone does it.
const CELLS = [ngeohash.encode(45.4205, -75.6828, 7), ngeohash.encode(45.4265, -75.692, 7)];
const OLD_ROWS = 48;

type StepKey =
  | "version"
  | "postgis"
  | "hypertable"
  | "insert"
  | "cagg15"
  | "caggDaily"
  | "realtime"
  | "refresh"
  | "policies"
  | "columnstore"
  | "compress"
  | "retention"
  | "geohash"
  | "size";

interface Step {
  key: StepKey;
  name: string;
  // Steps this one builds on. Every step also needs a working connection ("version").
  needs?: StepKey[];
  run: (sql: postgres.Sql) => Promise<string>;
}

async function dropSmokeObjects(sql: postgres.Sql) {
  await sql.unsafe("drop materialized view if exists smoke_daily");
  await sql.unsafe("drop materialized view if exists smoke_15m");
  await sql.unsafe("drop table if exists smoke_events cascade");
}

async function sumEvents(sql: postgres.Sql, view: "smoke_15m" | "smoke_daily") {
  const [row] = await sql.unsafe<{ total: number }[]>(
    `select coalesce(sum(events), 0)::int as total from ${view}`,
  );
  return row.total;
}

const steps: Step[] = [
  {
    key: "version",
    name: "TimescaleDB",
    run: async (sql) => {
      const [pg] = await sql<{ server_version: string }[]>`show server_version`;
      const rows = await sql<{ extversion: string }[]>`
        select extversion from pg_extension where extname = 'timescaledb'`;
      if (rows.length === 0) throw new Error("the timescaledb extension is not installed");
      return `TimescaleDB ${rows[0].extversion} on Postgres ${pg.server_version}`;
    },
  },
  {
    key: "postgis",
    name: "PostGIS",
    run: async (sql) => {
      await sql.unsafe("create extension if not exists postgis");
      const [row] = await sql<{ version: string }[]>`select postgis_lib_version() as version`;
      return `PostGIS ${row.version}`;
    },
  },
  {
    key: "hypertable",
    name: "Hypertable",
    run: async (sql) => {
      // Leftovers from a run that was killed halfway.
      await dropSmokeObjects(sql);
      await sql.unsafe(`
        create table smoke_events (
          time timestamptz not null,
          cell text not null,
          near_miss boolean not null default false
        )`);
      await sql.unsafe(`select create_hypertable('smoke_events', by_range('time', interval '1 day'))`);
      return "smoke_events with 1-day chunks";
    },
  },
  {
    key: "insert",
    name: "Insert rows",
    needs: ["hypertable"],
    run: async (sql) => {
      // One row per hour over the last 2 days, so the rows span 2 or 3 chunks.
      await sql`
        insert into smoke_events (time, cell, near_miss)
        select now() - i * interval '1 hour',
               case when i % 2 = 0 then ${CELLS[0]} else ${CELLS[1]} end,
               i % 3 = 0
        from generate_series(1, ${OLD_ROWS}) as i`;
      const [row] = await sql<{ n: number }[]>`select count(*)::int as n from smoke_events`;
      if (row.n !== OLD_ROWS) throw new Error(`expected ${OLD_ROWS} rows, found ${row.n}`);
      return `${row.n} rows in cells ${CELLS.join(" and ")}`;
    },
  },
  {
    key: "cagg15",
    name: "15-minute continuous aggregate",
    needs: ["hypertable"],
    run: async (sql) => {
      await sql.unsafe(`
        create materialized view smoke_15m
        with (timescaledb.continuous, timescaledb.materialized_only = false) as
        select time_bucket('15 minutes', time) as bucket,
               cell,
               count(*) as events,
               count(*) filter (where near_miss) as near_misses
        from smoke_events
        group by 1, 2
        with no data`);
      return "smoke_15m, real-time mode";
    },
  },
  {
    key: "caggDaily",
    name: "Daily aggregate stacked on the 15-minute one",
    needs: ["cagg15"],
    run: async (sql) => {
      await sql.unsafe(`
        create materialized view smoke_daily
        with (timescaledb.continuous, timescaledb.materialized_only = false) as
        select time_bucket('1 day', bucket) as day,
               cell,
               sum(events) as events,
               sum(near_misses) as near_misses
        from smoke_15m
        group by 1, 2
        with no data`);
      const rows = await sql<{ view_name: string; materialized_only: boolean }[]>`
        select view_name, materialized_only
        from timescaledb_information.continuous_aggregates
        where view_name in ('smoke_15m', 'smoke_daily')`;
      const stuck = rows.filter((r) => r.materialized_only).map((r) => r.view_name);
      if (rows.length !== 2) throw new Error(`expected 2 aggregates, found ${rows.length}`);
      if (stuck.length > 0) throw new Error(`still materialized-only: ${stuck.join(", ")}`);
      return "smoke_daily, real-time mode";
    },
  },
  {
    key: "realtime",
    name: "Real-time reads",
    needs: ["insert", "cagg15", "caggDaily"],
    run: async (sql) => {
      // Nothing has been refreshed yet, so both aggregates can only see
      // these rows through real-time mode.
      await sql`insert into smoke_events (time, cell, near_miss) values (now(), ${CELLS[0]}, true)`;
      const expected = OLD_ROWS + 1;
      const quarter = await sumEvents(sql, "smoke_15m");
      const daily = await sumEvents(sql, "smoke_daily");
      if (quarter !== expected || daily !== expected) {
        throw new Error(`expected ${expected} events in both, got 15m=${quarter} daily=${daily}`);
      }
      return `a fresh row shows in both aggregates with no refresh (${expected} events)`;
    },
  },
  {
    key: "refresh",
    name: "Manual refresh, 15-minute first",
    needs: ["cagg15", "caggDaily"],
    run: async (sql) => {
      await sql.unsafe("call refresh_continuous_aggregate('smoke_15m', null, null)");
      await sql.unsafe("call refresh_continuous_aggregate('smoke_daily', null, null)");
      const quarter = await sumEvents(sql, "smoke_15m");
      const daily = await sumEvents(sql, "smoke_daily");
      if (quarter !== daily) throw new Error(`totals differ after refresh: 15m=${quarter} daily=${daily}`);
      return `both still total ${quarter} events`;
    },
  },
  {
    key: "policies",
    name: "Refresh policies",
    needs: ["cagg15", "caggDaily"],
    run: async (sql) => {
      const [quarter] = await sql.unsafe<{ job: number }[]>(`
        select add_continuous_aggregate_policy('smoke_15m',
          start_offset => interval '3 days',
          end_offset => interval '1 minute',
          schedule_interval => interval '1 minute') as job`);
      const [daily] = await sql.unsafe<{ job: number }[]>(`
        select add_continuous_aggregate_policy('smoke_daily',
          start_offset => interval '30 days',
          end_offset => interval '1 hour',
          schedule_interval => interval '15 minutes') as job`);
      return `jobs ${quarter.job} (every 1 min) and ${daily.job} (every 15 min)`;
    },
  },
  {
    key: "columnstore",
    name: "Columnstore policy",
    needs: ["hypertable"],
    run: async (sql) => {
      try {
        await sql.unsafe(`
          alter table smoke_events set (
            timescaledb.enable_columnstore = true,
            timescaledb.segmentby = 'cell',
            timescaledb.orderby = 'time desc')`);
        await sql.unsafe("call add_columnstore_policy('smoke_events', after => interval '7 days')");
        return "new API: enable_columnstore + add_columnstore_policy";
      } catch (newError) {
        try {
          await sql.unsafe(`
            alter table smoke_events set (
              timescaledb.compress,
              timescaledb.compress_segmentby = 'cell',
              timescaledb.compress_orderby = 'time desc')`);
          await sql.unsafe("select add_compression_policy('smoke_events', interval '7 days')");
          return `older API: compress + add_compression_policy (new API said: ${message(newError)})`;
        } catch (oldError) {
          throw new Error(`new API: ${message(newError)}; older API: ${message(oldError)}`);
        }
      }
    },
  },
  {
    key: "compress",
    name: "Compress chunks now",
    needs: ["columnstore", "insert"],
    run: async (sql) => {
      // Phase 8 compresses the seed's older week by hand, so try it here.
      const done = await sql.unsafe<{ chunk: string }[]>(`
        select compress_chunk(c, if_not_compressed => true)::text as chunk
        from show_chunks('smoke_events') as c`);
      let stats = "";
      try {
        const [row] = await sql.unsafe<{ before: string | null; after: string | null }[]>(`
          select sum(before_compression_total_bytes)::bigint as before,
                 sum(after_compression_total_bytes)::bigint as after
          from hypertable_compression_stats('smoke_events')`);
        stats = `, ${row.before ?? "?"} bytes before, ${row.after ?? "?"} after`;
      } catch {
        stats = ", no compression stats function";
      }
      return `${done.length} chunks compressed${stats}`;
    },
  },
  {
    key: "retention",
    name: "Retention policy",
    needs: ["hypertable"],
    run: async (sql) => {
      const [row] = await sql.unsafe<{ job: number }[]>(
        "select add_retention_policy('smoke_events', drop_after => interval '180 days') as job",
      );
      return `job ${row.job}, drops chunks older than 180 days`;
    },
  },
  {
    key: "geohash",
    name: "ST_PointFromGeoHash",
    needs: ["postgis"],
    run: async (sql) => {
      const cell = CELLS[0];
      const [row] = await sql<{ lat: number; lon: number }[]>`
        select st_y(st_pointfromgeohash(${cell})) as lat,
               st_x(st_pointfromgeohash(${cell})) as lon`;
      const centre = ngeohash.decode(cell);
      const off = Math.max(Math.abs(row.lat - centre.latitude), Math.abs(row.lon - centre.longitude));
      if (off > 1e-6) {
        throw new Error(`PostGIS centre ${row.lat}, ${row.lon} doesn't match ngeohash ${centre.latitude}, ${centre.longitude}`);
      }
      return `${cell} centre ${row.lat.toFixed(5)}, ${row.lon.toFixed(5)} matches the phone's geohash library`;
    },
  },
  {
    key: "size",
    name: "Database size",
    run: async (sql) => {
      const [row] = await sql<{ bytes: string }[]>`select pg_database_size(current_database())::bigint as bytes`;
      const mb = Number(row.bytes) / 1024 / 1024;
      const detail = `${mb.toFixed(1)} MB of ${FREE_TIER_MB} MB`;
      if (mb >= FREE_TIER_MB * SIZE_WARNING_SHARE) {
        throw new Error(`${detail}: close to the free-tier limit, where the service turns read-only`);
      }
      return detail;
    },
  },
];

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const url = databaseUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL is not set.");
    console.error("Copy .env.example to .env.local, paste the Tiger Cloud connection string");
    console.error("after DATABASE_URL=, then run `npm run db:smoke` again.");
    return 1;
  }

  const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
  const passed = new Set<StepKey>();
  let failed = 0;

  try {
    for (const step of steps) {
      const needs: StepKey[] = step.key === "version" ? [] : ["version", ...(step.needs ?? [])];
      const missing = needs.filter((key) => !passed.has(key));
      if (missing.length > 0) {
        console.log(`SKIP  ${step.name}: needs ${missing.join(", ")}`);
        failed++;
        continue;
      }
      const started = Date.now();
      try {
        const detail = await step.run(sql);
        passed.add(step.key);
        console.log(`PASS  ${step.name} (${Date.now() - started} ms): ${detail}`);
      } catch (error) {
        console.log(`FAIL  ${step.name}: ${message(error)}`);
        failed++;
      }
    }
  } finally {
    if (passed.has("version")) {
      try {
        await dropSmokeObjects(sql);
        console.log("Cleaned up the smoke objects.");
      } catch (error) {
        console.log(`Cleanup failed, drop smoke_daily, smoke_15m and smoke_events by hand: ${message(error)}`);
        failed++;
      }
    }
    await sql.end({ timeout: 5 });
  }

  console.log(failed === 0 ? "All steps passed." : `${failed} step(s) failed or were skipped.`);
  return failed === 0 ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(message(error));
    process.exitCode = 1;
  },
);
