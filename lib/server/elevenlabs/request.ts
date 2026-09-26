import "server-only";
// Best Use of ElevenLabs: bounded, same-origin voice requests. No request media is persisted.
import { NETWORK, VOICE_ASK } from "@/lib/shared/params";

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function boundedBody(request: Request, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length")) > max) throw new RequestError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("Missing request body.", 400);
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new RequestError("Request too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

// Per-process backstop, not a distributed quota. A shared production quota belongs in Phase 6.
let windowStart = 0;
let calls = 0;
let active = 0;
export function admit(request: Request): () => void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new RequestError("Origin not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new RequestError("Origin not allowed.", 403);
  const now = Date.now();
  if (now - windowStart >= VOICE_ASK.budgetWindowMs) { windowStart = now; calls = 0; }
  const configured = Number(process.env.ASK_HOURLY_BUDGET);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : NETWORK.askHourlyBudget;
  if (calls >= limit || active >= VOICE_ASK.maxConcurrent) throw new RequestError("Voice questions are busy. Try again later.", 429);
  calls++; active++;
  return () => { active--; };
}

export function failure(error: unknown): Response {
  return Response.json({ error: error instanceof RequestError ? error.message : "Voice request failed. Please try again." }, {
    status: error instanceof RequestError ? error.status : 502,
    headers: { "Cache-Control": "no-store" },
  });
}
