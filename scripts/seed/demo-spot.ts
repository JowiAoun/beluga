// Tiger Data prize, demo setup (Phase 10): gives the demo spot's cell two simulated reporters for
// the staged category. The judge's live report is then the third distinct reporter, so the spot
// joins the fix-first queue on screen, marked as including simulated data. Labelled simulated in
// the database like every seeded row.
//
// Run `npm run demo-spot -- uottawa sidewalk_obstruction` (a station id) or
// `npm run demo-spot -- 45.4231,-75.6831 sidewalk_obstruction` (a point), and
// `npm run demo-spot -- --remove` after the demo. Needs DATABASE_URL in .env.local.

import postgres from "postgres";
import { databaseUrl } from "@/db/url";
import { deviceHash } from "@/lib/server/events";
import { CIVIC_CATEGORIES, CONSENT_VERSION, type CivicCategory, type Severity } from "@/lib/shared/enums";
import { cellOf, coarsen } from "@/lib/shared/geo";
import { STATIONS } from "@/lib/shared/stations";
import { STAGED_DESCRIPTION } from "./generate";

// The staged reports say what they are, so --remove finds exactly them.
const DESCRIPTION = STAGED_DESCRIPTION;
const REPORTERS = 2;
// What the reporting rules give each category in its usual case.
const SEVERITY: Record<CivicCategory, Severity> = {
  sidewalk_obstruction: 2,
  construction_barrier: 2,
  head_height_hazard: 3,
  surface_damage: 3,
  blocked_curb_cut: 2,
  tactile_strip_issue: 4,
  snow_ice: 3,
  other_fixed: 1,
};
const HAZARD_KIND: Partial<Record<CivicCategory, string>> = {
  head_height_hazard: "head_height",
  surface_damage: "drop_off",
  tactile_strip_issue: "drop_off",
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function where(arg: string | undefined): { lat: number; lon: number; station: string | null } {
  const station = STATIONS.find((s) => s.id === arg);
  if (station) return { lat: station.lat, lon: station.lon, station: station.id };
  const [lat, lon] = (arg ?? "").split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    fail(`Give a station (${STATIONS.map((s) => s.id).join(", ")}) or a point like 45.4231,-75.6831.`);
  }
  return { lat, lon, station: null };
}

async function main(): Promise<void> {
  const url = databaseUrl(process.env.DATABASE_URL);
  if (!url) fail("Set DATABASE_URL in .env.local first.");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { ssl: local ? false : "require", max: 1, onnotice: () => {} });
  try {
    if (process.argv.includes("--remove")) {
      const gone = await sql`delete from hazard_events where source = 'simulated' and description = ${DESCRIPTION}`;
      console.info(`Removed ${gone.count} staged demo reports.`);
      return;
    }
    const [placeArg, categoryArg] = process.argv.slice(2);
    const category = CIVIC_CATEGORIES.find((c) => c === categoryArg);
    if (!category) fail(`Give a category: ${CIVIC_CATEGORIES.join(", ")}.`);
    const place = where(placeArg);
    const { lat, lon } = coarsen(place.lat, place.lon);
    const cell = cellOf(lat, lon);
    const salt = process.env.DEVICE_HASH_SALT || "simulated";
    const now = Date.now();
    const rows = Array.from({ length: REPORTERS }, (_, i) => ({
      // A few minutes apart, within the last half hour.
      time: new Date(now - (i + 1) * 7 * 60_000),
      device_hash: deviceHash(`demo-spot-reporter-${i + 1}`, salt),
      event_kind: "civic_report",
      hazard_kind: HAZARD_KIND[category] ?? "obstacle",
      detector_class: "unknown",
      civic_category: category,
      severity: SEVERITY[category],
      confidence: 0.9,
      description: DESCRIPTION,
      closest_m: 1.5,
      lat,
      lon,
      cell,
      station_id: place.station,
      context: "sidewalk",
      source: "simulated",
      consent_version: CONSENT_VERSION,
    }));
    await sql`insert into hazard_events ${sql(rows)}`;
    console.info(
      `Staged ${REPORTERS} simulated reporters for ${category} in cell ${cell}. A live report of the same ` +
        "category in that cell makes 3, and the spot joins the fix-first queue.",
    );
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
