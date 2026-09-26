// Best Use of ElevenLabs: Scribe transcribes an explicitly recorded question.
import { VOICE_ASK } from "@/lib/shared/params";
import { admit, boundedBody, failure, RequestError } from "@/lib/server/elevenlabs/request";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    release = admit(request);
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new RequestError("Voice questions are not configured yet.", 503);
    const type = (request.headers.get("content-type") ?? "").split(";")[0];
    if (!["audio/webm", "audio/ogg", "audio/mp4"].includes(type)) throw new RequestError("Unsupported recording format.", 415);
    const bytes = await boundedBody(request, VOICE_ASK.audioMaxBytes);
    if (!bytes.length) throw new RequestError("The recording was empty.", 400);
    const form = new FormData();
    form.set("file", new Blob([bytes], { type }), `question.${type.split("/")[1]}`);
    form.set("model_id", "scribe_v2");
    form.set("tag_audio_events", "false");
    form.set("diarize", "false");
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": key }, body: form,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(VOICE_ASK.transcriptionTimeoutMs)]),
    });
    if (!response.ok) throw new RequestError("Could not transcribe the question.", 502);
    const result = await response.json();
    const text = typeof result.text === "string" ? result.text.trim() : "";
    if (!text || text.length > VOICE_ASK.questionMaxChars) throw new RequestError("Please ask a short question and try again.", 422);
    return Response.json({ question: text }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
