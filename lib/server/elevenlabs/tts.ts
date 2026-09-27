import "server-only";

// Best Use of ElevenLabs: the live Ask voice, in the voice the user picked, from ElevenLabs' most
// expressive model as lossless 48 kHz audio (lib/audio/voices.ts).

import { TTS_FORMAT, TTS_MODEL, voiceOf, type VoiceKey } from "@/lib/audio/voices";
import { env } from "../env";

const API = "https://api.elevenlabs.io/v1";

// The whole WAV in one piece: the phone decodes it with Web Audio, which can't play half a file.
export async function speak(text: string, voice: VoiceKey, signal?: AbortSignal): Promise<ArrayBuffer> {
  const { ELEVENLABS_API_KEY } = env("ELEVENLABS_API_KEY");
  const response = await fetch(`${API}/text-to-speech/${voiceOf(voice).elevenId}?output_format=${TTS_FORMAT}`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
    signal,
  });
  if (!response.ok) throw new Error(`text to speech: ${response.status}`);
  return response.arrayBuffer();
}
