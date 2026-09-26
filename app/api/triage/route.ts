// Best Use of ElevenLabs: civic triage through the triage agent, which sees the frame with Gemini.
// The agent only answers questions about the photo; severity and the report decision are worked
// out here from the fixed tables in lib/shared/reporting. The frame is never logged or stored.

import { NO_CATEGORY, TriageAnswerSchema } from "@/lib/server/agents/answers";
import { askAgent } from "@/lib/server/agents/ask";
import { AGENTS, triageNote } from "@/lib/server/agents/config";
import { takeBudget } from "@/lib/server/budget";
import { isDuplicateReport } from "@/lib/server/events";
import { withoutCrossingAdvice } from "@/lib/server/safety";
import { TriageRequestSchema, type TriageResponse } from "@/lib/shared/contracts";
import { decideReport, measuredFrom } from "@/lib/shared/reporting";
import { NETWORK } from "@/lib/shared/params";

// The answer comes back within the route's timeout; the rest is for deleting the conversation after
// ElevenLabs has saved it, which can take 10 s.
export const maxDuration = 30;

// Nothing reported: what the phone gets when triage can't give an answer.
function noReport(budgetRemaining: number, latencyMs: number): TriageResponse {
  return {
    report: false,
    category: null,
    isPublic: false,
    leftOrFixed: false,
    wayAround: "clear",
    caneWarning: false,
    tripOrDrop: false,
    severity: 1,
    confidence: 0,
    description: "",
    context: "unknown",
    box: null,
    budgetRemaining,
    latencyMs,
  };
}

function log(outcome: string, latencyMs: number, category: string | null = null, detail?: string): void {
  console.info(JSON.stringify({ route: "triage", agent: AGENTS.triage.name, latencyMs, outcome, category, detail }));
}

export async function POST(request: Request): Promise<Response> {
  const began = Date.now();
  const body = await request.json().catch(() => null);
  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { frame, hazard, sceneHint, cell, deviceKey } = parsed.data;

  const budgetRemaining = await takeBudget("triage");
  if (budgetRemaining === null) {
    log("budget_spent", Date.now() - began);
    return Response.json(noReport(0, Date.now() - began), { status: 429 });
  }

  const asked = await askAgent(
    AGENTS.triage,
    triageNote(hazard, sceneHint),
    Buffer.from(frame, "base64"),
    began + NETWORK.triageTimeoutMs,
    TriageAnswerSchema,
  );
  if (!asked.ok) {
    log(asked.reason, Date.now() - began, null, asked.detail);
    return Response.json(noReport(budgetRemaining, Date.now() - began), { status: 502 });
  }
  const answer = asked.answer;

  const category = answer.category === NO_CATEGORY ? null : answer.category;
  const salt = process.env.DEVICE_HASH_SALT;
  const decision = decideReport({
    category,
    answers: answer,
    confidence: answer.confidence,
    measured: measuredFrom(hazard, answer.context),
    duplicate: category !== null && salt !== undefined && (await isDuplicateReport(deviceKey, cell, category, salt)),
    budgetLeft: true,
  });
  const latencyMs = Date.now() - began;
  log(decision.report ? "report" : "no_report", latencyMs, category);
  const response: TriageResponse = {
    report: decision.report,
    category,
    isPublic: answer.isPublic,
    leftOrFixed: answer.leftOrFixed,
    wayAround: answer.wayAround,
    caneWarning: answer.caneWarning,
    tripOrDrop: answer.tripOrDrop,
    severity: decision.severity,
    confidence: answer.confidence,
    description: withoutCrossingAdvice(answer.description),
    context: answer.context,
    box: answer.box,
    budgetRemaining,
    latencyMs,
  };
  return Response.json(response);
}
