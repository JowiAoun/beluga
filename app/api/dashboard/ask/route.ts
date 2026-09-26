// Best Use of ElevenLabs, with Tiger Data: Ask the data (Phase 7 stretch). A planner's question
// goes to the data agent, which looks the numbers up through the dashboard's own queries and
// answers in a sentence or two. The response lists the lookups it used.

import { askData } from "@/lib/server/agents/data";
import { AGENTS } from "@/lib/server/agents/config";
import { takeBudget } from "@/lib/server/budget";
import { withoutCrossingAdvice } from "@/lib/server/safety";
import { AskDataRequestSchema, type AskDataResponse } from "@/lib/shared/contracts";
import { DASHBOARD } from "@/lib/shared/params";

// The answer takes up to 15 s; the rest is for deleting the conversation once ElevenLabs saved it.
export const maxDuration = 30;

function log(outcome: string, began: number, detail?: string): void {
  console.info(JSON.stringify({ route: "ask-data", agent: AGENTS.data.name, latencyMs: Date.now() - began, outcome, detail }));
}

export async function POST(request: Request): Promise<Response> {
  const began = Date.now();
  const parsed = AskDataRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });

  if ((await takeBudget("data")) === null) {
    log("budget_spent", began);
    return Response.json({ error: "budget_spent" }, { status: 429 });
  }
  const asked = await askData(parsed.data.question, began + DASHBOARD.askDataTimeoutMs);
  if (!asked.ok) {
    log(asked.reason, began, asked.detail);
    return Response.json({ error: asked.reason }, { status: asked.reason === "not_configured" ? 503 : 502 });
  }
  log("answered", began);
  const response: AskDataResponse = {
    answer: withoutCrossingAdvice(asked.answer.answer),
    lookups: asked.answer.lookups,
    includesSimulated: asked.answer.includesSimulated,
    latencyMs: Date.now() - began,
  };
  return Response.json(response);
}
