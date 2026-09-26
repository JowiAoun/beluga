import "server-only";

// Best Use of ElevenLabs: the live Ask voice. One calm voice, Flash v2.5 for speed.

import { env } from "../env";

const API = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_flash_v2_5";

// The whole MP3 in one piece: the phone decodes it with Web Audio, which can't play half a file.
export async function speak(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = env("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID");
  const response = await fetch(`${API}/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_TTS_MODEL || DEFAULT_MODEL }),
    signal,
  });
  if (!response.ok) throw new Error(`text to speech: ${response.status}`);
  return response.arrayBuffer();
}
