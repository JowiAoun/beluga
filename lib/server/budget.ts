import "server-only";

// Hourly call budgets for /api/triage and /api/ask, so a bug or a stranger can't drain the
// ElevenLabs credits. The count lives in the `api_budget` table, shared by every server instance.
// If the database can't be reached, each instance keeps its own count in memory instead.

import { DATABASE, NETWORK } from "@/lib/shared/params";
import { db, inTime } from "./db/client";
import { envNumber } from "./env";

export type BudgetRoute = "triage" | "ask";

const HOUR_MS = 60 * 60 * 1000;

function limitFor(route: BudgetRoute): number {
  return route === "triage"
    ? envNumber("TRIAGE_HOURLY_BUDGET", NETWORK.triageHourlyBudget)
    : envNumber("ASK_HOURLY_BUDGET", NETWORK.askHourlyBudget);
}

const memory = new Map<string, number>();

function takeFromMemory(route: BudgetRoute, limit: number, now: number): number | null {
  const hour = Math.floor(now / HOUR_MS);
  for (const key of memory.keys()) if (!key.endsWith(`:${hour}`)) memory.delete(key);
  const key = `${route}:${hour}`;
  const used = memory.get(key) ?? 0;
  if (used >= limit) return null;
  memory.set(key, used + 1);
  return limit - used - 1;
}

// Counts one call if the hour has room. Returns how many are left after it, or null when spent.
// A slow database costs at most DATABASE.quickQueryMs, then the memory count decides.
export async function takeBudget(route: BudgetRoute): Promise<number | null> {
  const limit = limitFor(route);
  try {
    const sql = db();
    const rows = await inTime(
      sql<{ count: number }[]>`
        insert into api_budget (hour, route, count)
        values (date_trunc('hour', now()), ${route}, 1)
        on conflict (hour, route) do update set count = api_budget.count + 1
        where api_budget.count < ${limit}
        returning count`,
      DATABASE.quickQueryMs,
    );
    return rows.length === 0 ? null : limit - rows[0].count;
  } catch {
    return takeFromMemory(route, limit, Date.now());
  }
}
