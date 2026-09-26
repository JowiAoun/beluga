// Tiger Data prize: the dashboard's read-only endpoints, /api/dashboard/queue, urgent, cells,
// stations, feed and perf. All read continuous aggregates except the feed and the timing itself.
// POST /api/dashboard/perf measures again.

import { z } from "zod";
import { cells, feed, queue, stations, urgent, type Filters } from "@/lib/server/db/dashboard";
import { db } from "@/lib/server/db/client";
import { latestPerf, measurePerf } from "@/lib/server/db/perf";
import { MissingEnvError } from "@/lib/server/env";
import type { PerfResponse } from "@/lib/shared/contracts";
import { CIVIC_CATEGORIES, DASHBOARD_WINDOWS, SOURCE_FILTERS } from "@/lib/shared/enums";
import { STATIONS } from "@/lib/shared/stations";

export const maxDuration = 15;

// The demo shows simulated rows unless DASHBOARD_SHOW_SIMULATED is "false".
const defaultSource = () => (process.env.DASHBOARD_SHOW_SIMULATED === "false" ? "live" : "both");

const QuerySchema = z.object({
  window: z.enum(DASHBOARD_WINDOWS).default("24h"),
  source: z.enum(SOURCE_FILTERS).optional(),
  category: z.enum(CIVIC_CATEGORIES).optional(),
  station: z.enum(STATIONS.map((s) => s.id) as [string, ...string[]]).optional(),
});

function failed(err: unknown): Response {
  const outcome = err instanceof MissingEnvError ? "not_configured" : "database_unavailable";
  console.error(JSON.stringify({ route: "dashboard", outcome }));
  return Response.json({ error: outcome }, { status: 503 });
}

export async function GET(request: Request, ctx: RouteContext<"/api/dashboard/[view]">): Promise<Response> {
  const { view } = await ctx.params;
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "bad query" }, { status: 400 });
  const filters: Filters = {
    window: parsed.data.window,
    source: parsed.data.source ?? defaultSource(),
    category: parsed.data.category ?? null,
  };
  try {
    const sql = db();
    switch (view) {
      case "queue":
        return Response.json(await queue(sql, filters));
      case "urgent":
        return Response.json(await urgent(sql, filters));
      case "cells":
        return Response.json(await cells(sql, filters));
      case "stations":
        return Response.json(await stations(sql, filters, parsed.data.station ?? null));
      case "feed":
        return Response.json(await feed(sql, filters));
      case "perf": {
        const latest = await latestPerf(sql);
        const body: PerfResponse = { includesSimulated: filters.source !== "live", latest };
        return Response.json(body);
      }
      default:
        return Response.json({ error: "unknown view" }, { status: 404 });
    }
  } catch (err) {
    return failed(err);
  }
}

export async function POST(_request: Request, ctx: RouteContext<"/api/dashboard/[view]">): Promise<Response> {
  const { view } = await ctx.params;
  if (view !== "perf") return Response.json({ error: "unknown view" }, { status: 404 });
  try {
    const latest = await measurePerf(db());
    const body: PerfResponse = { includesSimulated: true, latest };
    return Response.json(body);
  } catch (err) {
    return failed(err);
  }
}
