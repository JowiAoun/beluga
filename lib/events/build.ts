// Turns what the phone noticed into events for /api/events, coarsened before they are queued:
// about 100 m of location, a grid cell, and no image, audio or exact position.

import type { HazardEvent } from "@/lib/hazard/engine";
import type { BelugaEvent, Civic, HazardUpdate, TriageResponse } from "@/lib/shared/contracts";
import type { SceneContext } from "@/lib/shared/enums";
import { cellOf, coarsen } from "@/lib/shared/geo";

export interface Where {
  lat: number;
  lon: number;
  stationId?: string | null;
}

function base(
  kind: BelugaEvent["kind"],
  hazard: HazardUpdate,
  where: Where,
  deviceKey: string,
  context: SceneContext | null,
  at: Date,
): BelugaEvent {
  const { lat, lon } = coarsen(where.lat, where.lon);
  return {
    ts: at.toISOString(),
    deviceKey,
    kind,
    hazardKind: hazard.kind,
    detectorClass: hazard.label,
    closestDistance: Math.min(10, Math.max(0, hazard.distance)),
    angle: Math.max(-180, Math.min(180, hazard.angle)),
    lat,
    lon,
    cell: cellOf(lat, lon),
    ...(where.stationId ? { stationId: where.stationId } : {}),
    ...(context ? { context } : {}),
  };
}

export function fromHazardEvent(
  event: HazardEvent,
  where: Where,
  deviceKey: string,
  context: SceneContext | null,
  at = new Date(),
): BelugaEvent {
  return base(event.type, event.hazard, where, deviceKey, context, at);
}

// A civic report from a triage answer the backend said to report.
export function civicReport(
  hazard: HazardUpdate,
  triage: TriageResponse,
  where: Where,
  deviceKey: string,
  at = new Date(),
): BelugaEvent | null {
  if (!triage.report || !triage.category || triage.description.trim() === "") return null;
  const civic: Civic = {
    category: triage.category,
    severity: triage.severity,
    confidence: triage.confidence,
    description: triage.description,
  };
  return { ...base("civic_report", hazard, where, deviceKey, triage.context, at), civic };
}
