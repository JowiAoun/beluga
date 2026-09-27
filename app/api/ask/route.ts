// Best Use of ElevenLabs: image-aware answers and spoken responses.
import { AskAnswerSchema } from "@/lib/server/agents/answers";
import { askAgent } from "@/lib/server/agents/ask";
import { AGENTS, ASK_QUESTION } from "@/lib/server/agents/config";
import { takeBudget } from "@/lib/server/budget";
import { boundedBody, admit, failure, RequestError } from "@/lib/server/elevenlabs/request";
import { speak } from "@/lib/server/elevenlabs/tts";
import { DEFAULT_VOICE, isVoiceKey } from "@/lib/audio/voices";
import { withoutCrossingAdvice } from "@/lib/server/safety";
import { ASK_META_HEADER, AskRequestSchema, encodeAskMeta, type AskMeta } from "@/lib/shared/contracts";
import { FRAMES, NETWORK, VOICE_ASK } from "@/lib/shared/params";

// The answer comes back within the route's timeout; the rest is for deleting the conversation after
// ElevenLabs has saved it, which can take 10 s.
export const maxDuration = 30;

// Eleven v3 takes about 2 s for a two-sentence answer, so the voice keeps that much of the time.
const VOICE_RESERVE_MS = 2500;

function log(outcome: string, began: number, detail?: string): void {
  console.info(JSON.stringify({ route: "ask", agent: AGENTS.ask.name, latencyMs: Date.now() - began, outcome, detail }));
}

function sorry(status: number): Response {
  const meta: AskMeta = { answer: "Sorry, I couldn't see that.", label: null, box: null, voiceFailed: true };
  return Response.json(meta, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const began = Date.now();
  let release: (() => void) | undefined;
  try {
    release = admit(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new RequestError("Expected JSON.", 415);
    const bytes = await boundedBody(
      request,
      Math.ceil(FRAMES.maxFrameBytes / 3) * 4 + VOICE_ASK.requestOverheadBytes,
    );
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new RequestError("Invalid request.", 400);
    }
    const parsed = AskRequestSchema.safeParse(body);
    if (!parsed.success) throw new RequestError("Invalid image or question.", 400);
    const { frame, question } = parsed.data;
    const voice = isVoiceKey(parsed.data.voice) ? parsed.data.voice : DEFAULT_VOICE;

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
      log(asked.reason, began, asked.detail);
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
      const wav = await speak(meta.answer, voice, AbortSignal.timeout(left));
      log("answered", began);
      return new Response(wav, {
        headers: { "content-type": "audio/wav", [ASK_META_HEADER]: encodeAskMeta(meta), "cache-control": "no-store" },
      });
    } catch {
      log("voice_failed", began);
      return Response.json({ ...meta, voiceFailed: true }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    return failure(error);
  } finally {
    release?.();
  }
}
