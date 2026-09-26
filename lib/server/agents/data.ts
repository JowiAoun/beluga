import "server-only";

// Best Use of ElevenLabs, with Tiger Data: Ask the data (Phase 7 stretch). A planner's question
// goes to a third agent. Its lookup tools are the dashboard's own queries on the continuous
// aggregates, run by this backend on a read-only connection, so the agent never writes SQL and
// can't change anything. The answer comes back with the lookups it used.

import { after } from "next/server";
import type postgres from "postgres";
import { z } from "zod";
import { CIVIC_CATEGORIES, DASHBOARD_WINDOWS, SOURCE_FILTERS } from "@/lib/shared/enums";
import { DASHBOARD } from "@/lib/shared/params";
import { cellCentre } from "@/lib/shared/geo";
import { STATIONS } from "@/lib/shared/stations";
import { cells, feed, queue, stations, urgent } from "../db/dashboard";
import { inTime, readOnlyDb } from "../db/client";
import { MissingEnvError } from "../env";
import { AGENTS } from "./config";
import { AgentError, deleteConversation, runAgentTurn, sweepConversations, type TurnDeps } from "./turn";

export interface Lookup {
  tool: string;
  filters: Record<string, string>;
}

export interface DataAnswer {
  answer: string;
  lookups: Lookup[];
  includesSimulated: boolean;
}

export type DataOutcome =
  | { ok: true; answer: DataAnswer }
  | { ok: false; reason: "not_configured" | "agent_failed" | "invalid_answer"; detail?: string };

const STATION_IDS = STATIONS.map((s) => s.id);

// The tool schemas list the allowed values; anything else falls back to the widest choice.
const FiltersSchema = z.object({
  window: z.enum(DASHBOARD_WINDOWS).catch("7d"),
  category: z.enum([...CIVIC_CATEGORIES, "all"]).catch("all"),
  source: z.enum(SOURCE_FILTERS).catch("both"),
  station: z.enum([...STATION_IDS, "all"]).catch("all"),
});
type LookupFilters = z.infer<typeof FiltersSchema>;

const AnswerSchema = z.object({ answer: z.string().trim().min(1).max(400) });

// Only the filters each lookup takes, for the answer's "looked at" line.
const USES: Record<string, Array<keyof LookupFilters>> = {
  fix_first_queue: ["window", "category", "station", "source"],
  check_now: ["category", "source"],
  busiest_cells: ["window", "source"],
  station_near_misses: ["station", "source"],
  recent_reports: ["category", "source"],
};

const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places;

// A cell has no name, so it goes by its nearest station when one is within a kilometre.
const NEAR_STATION_M = 1000;

function nearestStation(cell: string): { id: string; name: string; metres: number } {
  const { lat, lon } = cellCentre(cell);
  let best = { id: "", name: "", metres: Infinity };
  for (const s of STATIONS) {
    const metres = Math.hypot((s.lat - lat) * 111_320, (s.lon - lon) * 111_320 * Math.cos((lat * Math.PI) / 180));
    if (metres < best.metres) best = { id: s.id, name: s.name, metres };
  }
  return best;
}

export function placeOf(cell: string): string {
  const near = nearestStation(cell);
  return near.metres <= NEAR_STATION_M ? `${Math.round(near.metres / 10) * 10} m from ${near.name}` : `cell ${cell}`;
}

function ottawaTime(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// The agent sees the simulated flag too, so it can say so in the answer.
function found(result: object, includesSimulated: boolean): { result: unknown; includesSimulated: boolean } {
  return { result: { ...result, includesSimulated }, includesSimulated };
}

// Runs one lookup and shrinks its rows to what the agent needs, so the answer stays quick.
export async function runLookup(
  sql: postgres.Sql,
  tool: string,
  f: LookupFilters,
): Promise<{ result: unknown; includesSimulated: boolean }> {
  const category = f.category === "all" ? null : f.category;
  switch (tool) {
    case "fix_first_queue": {
      const data = await queue(sql, { window: f.window, source: f.source, category });
      const near = (cell: string) => {
        const station = nearestStation(cell);
        return station.id === f.station && station.metres <= NEAR_STATION_M;
      };
      const ranked = data.rows.map((r, i) => ({ r, rank: i + 1 }));
      const picked = f.station === "all" ? ranked : ranked.filter(({ r }) => near(r.cell));
      const rows = picked.slice(0, DASHBOARD.askDataRows).map(({ r, rank }) => ({
        rank,
        place: placeOf(r.cell),
        category: r.category,
        whoFixesIt: r.whoFixesIt,
        worstSeverity: r.worstSeverity,
        reporters: r.reporters,
        nearMisses: r.nearMisses,
        lastSeen: ottawaTime(r.lastSeen),
        score: round(r.score),
        includesSimulated: r.includesSimulated,
      }));
      return found({ rows }, data.includesSimulated);
    }
    case "check_now": {
      const data = await urgent(sql, { window: "14d", source: f.source, category });
      const rows = data.rows.slice(0, DASHBOARD.askDataRows).map((r) => ({
        place: placeOf(r.cell),
        category: r.category,
        whoFixesIt: r.whoFixesIt,
        day: r.day,
        source: r.source,
      }));
      return found({ rows }, data.includesSimulated);
    }
    case "busiest_cells": {
      const data = await cells(sql, { window: f.window, source: f.source, category: null });
      const rows = [...data.rows]
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.events - a.events)
        .slice(0, DASHBOARD.askDataRows)
        .map((r) => ({
          place: placeOf(r.cell),
          events: r.events,
          nearMisses: r.nearMisses,
          reports: r.reports,
          score: r.score === null ? null : round(r.score),
        }));
      return found({ rows }, data.includesSimulated);
    }
    case "station_near_misses": {
      const one = f.station === "all" ? null : f.station;
      const data = await stations(sql, { window: "7d", source: f.source, category: null }, one);
      const totals = data.series
        .map((s) => ({ station: s.name, nearMisses: s.points.reduce((sum, p) => sum + p.nearMisses, 0) }))
        .sort((a, b) => b.nearMisses - a.nearMisses);
      const busiestHours = data.profile
        ? [...data.profile.hours]
            .sort((a, b) => b.nearMisses - a.nearMisses)
            .slice(0, 3)
            .map((h) => ({ hour: `${h.hour}:00`, nearMisses: h.nearMisses }))
        : undefined;
      return found({ window: "last 7 days", totals, busiestHours }, data.includesSimulated);
    }
    case "recent_reports": {
      const data = await feed(sql, { window: "14d", source: f.source, category });
      const rows = data.rows.slice(0, DASHBOARD.askDataRows).map((r) => ({
        time: ottawaTime(r.time),
        category: r.category,
        severity: r.severity,
        description: r.description,
        place: placeOf(r.cell),
        source: r.source,
      }));
      return found({ rows }, data.includesSimulated);
    }
    default:
      throw new Error(`no lookup called ${tool}`);
  }
}

export async function askData(
  question: string,
  deadline: number,
  deps?: TurnDeps,
  later: (task: () => Promise<unknown>) => void = after,
  sql: () => postgres.Sql = readOnlyDb,
): Promise<DataOutcome> {
  const lookups: Lookup[] = [];
  let includesSimulated = false;
  let conversationId: string | null = null;
  try {
    const { parameters } = await runAgentTurn(
      {
        agent: AGENTS.data,
        text: question,
        deadline,
        onConversation: (id) => (conversationId = id),
        onLookup: async (tool, parameters) => {
          const filters = FiltersSchema.parse(parameters ?? {});
          const used = USES[tool] ?? [];
          lookups.push({ tool, filters: Object.fromEntries(used.map((k) => [k, filters[k]])) });
          const found = await inTime(runLookup(sql(), tool, filters), DASHBOARD.askDataLookupMs);
          includesSimulated ||= found.includesSimulated;
          return found.result;
        },
      },
      deps,
    );
    const checked = AnswerSchema.safeParse(parameters);
    if (!checked.success) return { ok: false, reason: "invalid_answer" };
    return { ok: true, answer: { answer: checked.data.answer, lookups, includesSimulated } };
  } catch (err) {
    if (err instanceof MissingEnvError) return { ok: false, reason: "not_configured" };
    if (!(err instanceof AgentError)) throw err;
    return { ok: false, reason: "agent_failed", detail: err.message.slice(0, 160) };
  } finally {
    // No frame here, but the question and the numbers needn't stay with ElevenLabs either.
    const id: string | null = conversationId;
    if (id) later(() => deleteConversation(id, deps).then(() => sweepConversations(AGENTS.data, deps)));
  }
}
