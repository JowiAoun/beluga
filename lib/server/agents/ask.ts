import "server-only";

// Asks an agent about one frame and checks its answer. One retry, only when there is still time:
// the agent may answer in plain text instead of its tool, or with fields that don't fit.

import { after } from "next/server";
import type { z } from "zod";
import { MissingEnvError } from "../env";
import type { AgentSpec } from "./config";
import { AgentError, deleteConversation, runAgentTurn, type TurnDeps } from "./turn";

// A retry needs about this long to have a chance.
const RETRY_MIN_MS = 2000;

export type AskOutcome<T> =
  { ok: true; answer: T } | { ok: false; reason: "not_configured" | "agent_failed" | "invalid_answer" };

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
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && deadline - Date.now() < RETRY_MIN_MS) break;
    try {
      const { parameters } = await runAgentTurn(
        {
          agent,
          text,
          jpeg,
          deadline,
          // The conversation holds the frame, so it goes whatever happens next.
          onConversation: (id) => later(() => deleteConversation(id, deps)),
        },
        deps,
      );
      const checked = schema.safeParse(parameters);
      if (checked.success) return { ok: true, answer: checked.data };
      reason = "invalid_answer";
    } catch (err) {
      if (err instanceof MissingEnvError) return { ok: false, reason: "not_configured" };
      if (!(err instanceof AgentError)) throw err;
      reason = "agent_failed";
    }
  }
  return { ok: false, reason };
}
