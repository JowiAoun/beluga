import "server-only";

// Tiger Data prize: turns a batch from the phone into hazard_events rows (Phase 6 intake).
// Privacy is enforced again here, whatever the phone sent: locations are rounded to about 100 m
// and the cell recomputed, civic fields are dropped from other events, and a device key becomes
// a salted hash on civic reports only. The raw key is never stored.

import { createHmac } from "node:crypto";
import type postgres from "postgres";
import { EventSchema, type BelugaEvent } from "@/lib/shared/contracts";
import { cellOf, coarsen } from "@/lib/shared/geo";
import { NETWORK } from "@/lib/shared/params";
import { db } from "./db/client";

export interface EventRow {
  time: string;
  device_hash: string | null;
  event_kind: string;
  hazard_kind: string;
  detector_class: string;
  civic_category: string | null;
  severity: number | null;
  confidence: number | null;
  description: string | null;
  closest_m: number;
  angle_deg: number | null;
  heading_deg: number | null;
  lat: number;
  lon: number;
  cell: string;
  station_id: string | null;
  context: string | null;
  consent_version: number;
}

const DEVICE_HASH_LENGTH = 16;

export function deviceHash(deviceKey: string, salt: string): string {
  return createHmac("sha256", salt).update(deviceKey).digest("hex").slice(0, DEVICE_HASH_LENGTH);
}

// Checks each event on its own: a bad one only drops itself. `now` in milliseconds.
export function prepareEvents(
  events: unknown[],
  consentVersion: number,
  salt: string,
  now = Date.now(),
): { rows: EventRow[]; rejected: number } {
  const rows: EventRow[] = [];
  let rejected = 0;
  const oldest = now - NETWORK.eventMaxAgeDays * 24 * 60 * 60 * 1000;
  const newest = now + NETWORK.eventMaxFutureMinutes * 60 * 1000;
  for (const raw of events) {
    const parsed = EventSchema.safeParse(raw);
    const at = parsed.success ? Date.parse(parsed.data.ts) : NaN;
    if (!parsed.success || !(at >= oldest && at <= newest)) {
      rejected++;
      continue;
    }
    rows.push(toRow(parsed.data, consentVersion, salt));
  }
  return { rows, rejected };
}

function toRow(event: BelugaEvent, consentVersion: number, salt: string): EventRow {
  const { lat, lon } = coarsen(event.lat, event.lon);
  const civic = event.kind === "civic_report" ? (event.civic ?? null) : null;
  return {
    time: new Date(event.ts).toISOString(),
    device_hash: civic ? deviceHash(event.deviceKey, salt) : null,
    event_kind: event.kind,
    hazard_kind: event.hazardKind,
    detector_class: event.detectorClass,
    civic_category: civic?.category ?? null,
    severity: civic?.severity ?? null,
    confidence: civic?.confidence ?? null,
    description: civic?.description ?? null,
    closest_m: event.closestDistance,
    angle_deg: event.angle ?? null,
    heading_deg: event.heading ?? null,
    lat,
    lon,
    cell: cellOf(lat, lon),
    station_id: event.stationId ?? null,
    context: event.context ?? null,
    consent_version: consentVersion,
  };
}

// The same phone reported the same category in the same cell in the last 15 minutes. A database
// problem counts as no duplicate: the 3-reporter rule still guards the queue.
export async function isDuplicateReport(
  deviceKey: string,
  cell: string,
  category: string,
  salt: string,
): Promise<boolean> {
  try {
    const rows = await db()`
      select 1 from hazard_events
      where device_hash = ${deviceHash(deviceKey, salt)}
        and cell = ${cell}
        and civic_category = ${category}
        and time > now() - ${`${NETWORK.reportDedupMs} milliseconds`}::interval
      limit 1`;
    return rows.length > 0;
  } catch {
    return false;
  }
}

// One multi-row statement. A missing station is the nearest one within 150 m, found by PostGIS.
// An unknown station id is dropped rather than failing the batch.
export async function insertEvents(rows: EventRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = db();
  await sql`
    insert into hazard_events (
      time, device_hash, event_kind, hazard_kind, detector_class, civic_category, severity, confidence,
      description, closest_m, angle_deg, heading_deg, lat, lon, cell, station_id, context, source, consent_version
    )
    select
      e.time, e.device_hash, e.event_kind, e.hazard_kind, e.detector_class, e.civic_category, e.severity,
      e.confidence, e.description, e.closest_m, e.angle_deg, e.heading_deg, e.lat, e.lon, e.cell,
      coalesce(
        (select s.station_id from stations s where s.station_id = e.station_id),
        (select s.station_id from stations s
          where st_dwithin(s.location, st_point(e.lon, e.lat, 4326)::geography, ${NETWORK.stationSnapRadiusM})
          order by s.location <-> st_point(e.lon, e.lat, 4326)::geography
          limit 1)
      ),
      e.context, 'live', e.consent_version
    from jsonb_to_recordset(${sql.json(rows as unknown as postgres.JSONValue)}) as e(
      time timestamptz, device_hash text, event_kind text, hazard_kind text, detector_class text,
      civic_category text, severity smallint, confidence real, description text, closest_m real,
      angle_deg real, heading_deg real, lat double precision, lon double precision, cell text,
      station_id text, context text, consent_version smallint
    )`;
}
