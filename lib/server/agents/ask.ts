import "server-only";

// Asks an agent about one frame and checks its answer. One retry, only when there is still time:
// the agent may answer in plain text instead of its tool, or with fields that don't fit.

import { after } from "next/server";
import type { z } from "zod";
import { MissingEnvError } from "../env";
import type { AgentSpec } from "./config";
import { AgentError, deleteConversation, runAgentTurn, sweepConversations, type TurnDeps } from "./turn";

// A retry needs about this long to have a chance.
const RETRY_MIN_MS = 2000;

// `detail` says what went wrong, for the route log: an error from the turn or the fields that didn't
// fit. It never holds the frame or the answer's text.
export type AskOutcome<T> =
  | { ok: true; answer: T }
  | { ok: false; reason: "not_configured" | "agent_failed" | "invalid_answer"; detail?: string };

export async function askAgent<T>(
  agent: AgentSpec,
  text: string,
  jpeg: Uint8Array,
  deadline: number,
  schema: z.ZodType<T>,
  deps?: TurnDeps,
  // Where conversation deletes are scheduled. After the response, in a route.
  later: (task: () => Promise<unknown>) => void = after,
): Promise<AskOutcome<T>> {
  let reason: "agent_failed" | "invalid_answer" = "agent_failed";
  let detail: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && deadline - Date.now() < RETRY_MIN_MS) break;
    let conversationId: string | null = null;
    try {
      const { parameters } = await runAgentTurn(
        { agent, text, jpeg, deadline, onConversation: (id) => (conversationId = id) },
        deps,
      );
      const checked = schema.safeParse(parameters);
      if (checked.success) return { ok: true, answer: checked.data };
      reason = "invalid_answer";
      detail = checked.error.issues.map((i) => i.path.join(".")).join(",");
    } catch (err) {
      if (err instanceof MissingEnvError) return { ok: false, reason: "not_configured" };
      if (!(err instanceof AgentError)) throw err;
      reason = "agent_failed";
      detail = err.message.slice(0, 160);
    } finally {
      // The conversation holds the frame, so it goes whatever happened. Scheduled here and not in
      // the socket's callback: that can run in an earlier request's context, where after() runs
      // the delete at once, before the frame is even uploaded.
      // The sweep then clears anything an earlier call left behind.
      const id: string | null = conversationId;
      if (id) later(() => deleteConversation(id, deps).then(() => sweepConversations(agent, deps)));
    }
  }
  return { ok: false, reason, detail };
}
