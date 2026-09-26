// Best Use of ElevenLabs: Ask. The Ask agent sees the frame with Gemini and answers through its
// tool; ElevenLabs Flash v2.5 speaks the answer. The whole MP3 comes back as the body, with the
// answer, label and box in a header, so the phone can play it from the object's side.

import { AskAnswerSchema } from "@/lib/server/agents/answers";
import { askAgent } from "@/lib/server/agents/ask";
import { AGENTS, ASK_QUESTION } from "@/lib/server/agents/config";
import { takeBudget } from "@/lib/server/budget";
import { speak } from "@/lib/server/elevenlabs/tts";
import { withoutCrossingAdvice } from "@/lib/server/safety";
import { ASK_META_HEADER, AskRequestSchema, encodeAskMeta, type AskMeta } from "@/lib/shared/contracts";
import { NETWORK } from "@/lib/shared/params";

export const maxDuration = 15;

// The agent gets most of the time; the voice needs about a second.
const VOICE_RESERVE_MS = 1500;

function log(outcome: string, began: number): void {
  console.info(JSON.stringify({ route: "ask", agent: AGENTS.ask.name, latencyMs: Date.now() - began, outcome }));
}

// The phone says `answer` with its own voice whenever voiceFailed is set.
function sorry(status: number): Response {
  const meta: AskMeta = { answer: "Sorry, I couldn't see that.", label: null, box: null, voiceFailed: true };
  return Response.json(meta, { status });
}

export async function POST(request: Request): Promise<Response> {
  const began = Date.now();
  const body = await request.json().catch(() => null);
  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const { frame, question } = parsed.data;

  if ((await takeBudget("ask")) === null) {
    log("budget_spent", began);
    return sorry(429);
  }

  const asked = await askAgent(
    AGENTS.ask,
    question || ASK_QUESTION,
    Buffer.from(frame, "base64"),
    began + NETWORK.askTimeoutMs - VOICE_RESERVE_MS,
    AskAnswerSchema,
  );
  if (!asked.ok) {
    log(asked.reason, began);
    return sorry(502);
  }

  const meta: AskMeta = {
    answer: withoutCrossingAdvice(asked.answer.answer),
    label: asked.answer.label,
    box: asked.answer.box,
    voiceFailed: false,
  };
  try {
    const left = Math.max(500, began + NETWORK.askTimeoutMs - Date.now());
    const mp3 = await speak(meta.answer, AbortSignal.timeout(left));
    log("answered", began);
    return new Response(mp3, {
      headers: { "content-type": "audio/mpeg", [ASK_META_HEADER]: encodeAskMeta(meta), "cache-control": "no-store" },
    });
  } catch {
    // The answer is still good; the phone says it with its own voice.
    log("voice_failed", began);
    return Response.json({ ...meta, voiceFailed: true });
  }
}
