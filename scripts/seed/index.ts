// Tiger Data prize: loads the simulated fortnight (scripts/seed/generate.ts) with COPY, refreshes
// the four continuous aggregates, compresses the older week, and stores a performance snapshot.
//
// Run `npm run seed`. `npm run seed -- --reset` deletes simulated rows first (live rows stay).
// Needs the migrations (`npm run db:migrate`) and DATABASE_URL in .env.local.

import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";
import { deviceHash } from "@/lib/server/events";
import { measurePerf } from "@/lib/server/db/perf";
import { CONSENT_VERSION } from "@/lib/shared/enums";
import { DATABASE, SEED } from "@/lib/shared/params";
import { generate, type SeedRow } from "./generate";

const COLUMNS = [
  "time",
  "device_hash",
  "event_kind",
  "hazard_kind",
  "detector_class",
  "civic_category",
  "severity",
  "confidence",
  "description",
  "closest_m",
  "angle_deg",
  "heading_deg",
  "lat",
  "lon",
  "cell",
  "station_id",
  "context",
  "source",
  "consent_version",
];

// Simulated device keys are hashed like live ones, with the live salt when there is one.
const SALT = process.env.DEVICE_HASH_SALT || "simulated";
// Stop before the free service's read-only limit.
const MAX_SIZE_SHARE = 0.9;

function csv(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function line(row: SeedRow): string {
  return `${[
    row.time.toISOString(),
    row.deviceKey && deviceHash(row.deviceKey, SALT),
    row.eventKind,
    row.hazardKind,
    row.detectorClass,
    row.civicCategory,
    row.severity,
    row.confidence === null ? null : row.confidence.toFixed(2),
    row.description,
    row.closestM.toFixed(2),
    row.angleDeg.toFixed(1),
    row.headingDeg.toFixed(0),
    row.lat,
    row.lon,
    row.cell,
    row.stationId,
    row.context,
    "simulated",
    CONSENT_VERSION,
  ]
    .map(csv)
    .join(",")}\n`;
}

function* lines(counter: { rows: number }): Generator<string> {
  let chunk = "";
  for (const row of generate()) {
    chunk += line(row);
    counter.rows++;
    if (chunk.length > 64 * 1024) {
      yield chunk;
      chunk = "";
    }
  }
  if (chunk) yield chunk;
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Put the Tiger Cloud connection string in .env.local.");
    return 1;
  }
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { ssl: local ? false : "require", max: 1, onnotice: () => {} });
  try {
    const [size] = await sql<Array<{ mb: number }>>`select pg_database_size(current_database()) / 1048576.0 as mb`;
    console.log(`Database is ${Number(size.mb).toFixed(0)} MB of ${DATABASE.freeServiceLimitMb} MB.`);
    if (size.mb > DATABASE.freeServiceLimitMb * MAX_SIZE_SHARE) {
      console.error("Too close to the free service's limit, where it turns read-only. Not loading.");
      return 1;
    }

    const [existing] = await sql<Array<{ n: number }>>`
      select count(*)::int as n from hazard_events where source = 'simulated'`;
    if (existing.n > 0 && !process.argv.includes("--reset")) {
      console.error(`${existing.n} simulated rows are already loaded. Run npm run seed -- --reset to replace them.`);
      return 1;
    }
    if (existing.n > 0) {
      const began = Date.now();
      await sql`delete from hazard_events where source = 'simulated'`;
      console.log(`Deleted ${existing.n} simulated rows in ${((Date.now() - began) / 1000).toFixed(1)} s.`);
    }

    const counter = { rows: 0 };
    const began = Date.now();
    const copy = await sql.unsafe(`copy hazard_events (${COLUMNS.join(", ")}) from stdin with (format csv)`).writable();
    await pipeline(Readable.from(lines(counter)), copy);
    const loadSeconds = (Date.now() - began) / 1000;
    console.log(`Loaded ${counter.rows} simulated rows over ${SEED.days} days in ${loadSeconds.toFixed(1)} s.`);

    // The 15-minute aggregate first: the daily one is built on it. Only up to an hour ago, like the
    // policies: refreshing to the end would also store today's unfinished day, and an aggregate's
    // real-time part only reads raw rows newer than what is stored. Live reports later today would
    // then stay out of the fix-first queue until tomorrow.
    for (const view of ["cell_15m", "cell_daily", "station_hourly", "cell_reporters_daily"]) {
      const started = Date.now();
      await sql.unsafe(`call refresh_continuous_aggregate('${view}', null, now() - interval '1 hour')`);
      console.log(`Refreshed ${view} in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
    }

    const compressed = await sql<Array<{ chunk: string }>>`
      select compress_chunk(c, if_not_compressed => true)::text as chunk
      from show_chunks('hazard_events', older_than => interval '7 days') as c`;
    console.log(`Compressed ${compressed.length} chunks older than 7 days.`);

    const perf = await measurePerf(sql, loadSeconds);
    const ratio = perf.compressionRatio === null ? "no compression stats" : `${perf.compressionRatio.toFixed(1)}x smaller`;
    console.log(
      `Performance: raw ${perf.rawMs.toFixed(1)} ms, aggregate ${perf.aggregateMs.toFixed(1)} ms, ` +
        `compressed chunks ${ratio}, ${perf.totalRows} rows in all.`,
    );
    return 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().then(
  (code) => (process.exitCode = code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  },
);
