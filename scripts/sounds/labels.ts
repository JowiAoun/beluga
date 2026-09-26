// Best Use of ElevenLabs: generate reusable spoken labels once, never during hazard detection.
// npm run sounds:labels — requires ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.
// PCM output is wrapped as mono WAV without requiring ffmpeg.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { CLIP_TEXT, type LibraryManifest } from "../../lib/audio/library";

async function main() {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) throw new Error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env.local.");
  await mkdir("public/sounds/voice", { recursive: true });
  const manifest: LibraryManifest = await readFile("public/sounds/manifest.json", "utf8")
    .then((text) => JSON.parse(text)).catch(() => ({ generatedAt: "", sounds: {}, clips: {} }));
  for (const [id, text] of Object.entries(CLIP_TEXT)) {
    const file = `voice/${id}.wav`;
    const existing = await readFile(`public/sounds/${file}`).catch(() => null);
    if (!existing) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_24000`, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_flash_v2_5" }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Label ${id}: ElevenLabs returned ${response.status}.`);
      const pcm = Buffer.from(await response.arrayBuffer());
      if (pcm.length === 0 || pcm.length % 2 !== 0) throw new Error(`Invalid PCM for ${id}.`);
      const header = Buffer.alloc(44);
      header.write("RIFF", 0); header.writeUInt32LE(pcm.length + 36, 4); header.write("WAVEfmt ", 8);
      header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
      header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
      header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
      header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
      await writeFile(`public/sounds/${file}`, Buffer.concat([header, pcm]));
    }
    manifest.clips[id as keyof typeof CLIP_TEXT] = { file, text };
    manifest.generatedAt = new Date().toISOString();
    await writeFile("public/sounds/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
    console.info(`Prepared label: ${id}`);
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Label generation failed.");
  process.exitCode = 1;
});
