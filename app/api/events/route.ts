// Tiger Data prize: batch intake of hazard events and civic reports into the hazard_events
// hypertable. The continuous aggregates pick new rows up at once, in real-time mode.

import { MissingEnvError, env } from "@/lib/server/env";
import { insertEvents, prepareEvents } from "@/lib/server/events";
import { EventBatchEnvelopeSchema, type EventBatchResult } from "@/lib/shared/contracts";

export const maxDuration = 10;

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  // A batch without a consent version is refused whole: reporting was never agreed to.
  const envelope = EventBatchEnvelopeSchema.safeParse(body);
  if (!envelope.success) return Response.json({ error: "bad batch" }, { status: 400 });

  try {
    const { DEVICE_HASH_SALT } = env("DEVICE_HASH_SALT");
    const { rows, rejected } = prepareEvents(envelope.data.events, envelope.data.consentVersion, DEVICE_HASH_SALT);
    await insertEvents(rows);
    const result: EventBatchResult = { accepted: rows.length, rejected };
    console.info(JSON.stringify({ route: "events", ...result }));
    return Response.json(result);
  } catch (err) {
    const outcome = err instanceof MissingEnvError ? "not_configured" : "insert_failed";
    console.error(JSON.stringify({ route: "events", outcome }));
    // The phone keeps the batch and tries again later.
    return Response.json({ error: outcome }, { status: 503 });
  }
}
