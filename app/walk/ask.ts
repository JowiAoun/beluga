// Ask on the phone: one camera frame to /api/ask, and back the answer's audio plus where the
// object sits, so the answer plays from its side. Nothing here is part of the safety loop.

import { panForAngle, type Pan } from "@/lib/audio/placement";
import { ASK_META_HEADER, AskMetaSchema, decodeAskMeta, type AskMeta } from "@/lib/shared/contracts";
import { NETWORK } from "@/lib/shared/params";
import type { SensingSession } from "@/lib/xr/session";

export type AskResult =
  | { kind: "audio"; meta: AskMeta; buffer: AudioBuffer; pan: Pan }
  // The phone says it with its own voice: the answer, or the server's apology.
  | { kind: "text"; meta: AskMeta; pan: Pan }
  | { kind: "offline" }
  | { kind: "no_frame" };

// A JPEG as raw base64, the way /api/ask and /api/triage take frames.
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// The box is top, left, bottom, right on a 0 to 1000 scale; its middle gives the angle.
export function panForBox(box: AskMeta["box"], hfovDeg: number): Pan {
  if (!box) return 0;
  const centre = (box[1] + box[3]) / 2000;
  return panForAngle((centre - 0.5) * hfovDeg);
}

export async function askAboutView(
  session: SensingSession,
  ctx: BaseAudioContext,
  hfovDeg: number,
  question?: string,
): Promise<AskResult> {
  if (!navigator.onLine) return { kind: "offline" };
  const frame = await session.captureFrame();
  if (!frame) return { kind: "no_frame" };
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ frame: await toBase64(frame.blob), ...(question ? { question } : {}) }),
    signal: AbortSignal.timeout(NETWORK.askTimeoutMs + 2000),
  }).catch(() => null);
  if (!response) return { kind: "offline" };

  if (response.ok && response.headers.get("content-type")?.startsWith("audio/")) {
    const meta = decodeAskMeta(response.headers.get(ASK_META_HEADER));
    if (meta) {
      const pan = panForBox(meta.box, hfovDeg);
      try {
        return { kind: "audio", meta, buffer: await ctx.decodeAudioData(await response.arrayBuffer()), pan };
      } catch {
        return { kind: "text", meta: { ...meta, voiceFailed: true }, pan };
      }
    }
  }
  const parsed = AskMetaSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return { kind: "offline" };
  return { kind: "text", meta: parsed.data, pan: panForBox(parsed.data.box, hfovDeg) };
}
