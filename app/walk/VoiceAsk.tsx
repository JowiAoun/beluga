"use client";
// Best Use of ElevenLabs: explicit microphone recording → Scribe → image agent → spatial TTS.
import { useEffect, useRef, useState } from "react";
import type { AudioEngine } from "@/lib/audio/engine";
import { decodeFile } from "@/lib/audio/library";
import { panForAngle } from "@/lib/audio/placement";
import { ASK_META_HEADER, AskMetaSchema, decodeAskMeta } from "@/lib/shared/contracts";
import { VOICE_ASK } from "@/lib/shared/params";
import type { SensingSession } from "@/lib/xr/session";

type Stage = "idle" | "permission" | "recording" | "transcribing" | "answering";

export default function VoiceAsk({ session, microphone, getAudio, getEngine, getFov }: {
  session: SensingSession; microphone: string;
  getAudio: () => AudioContext | null; getEngine: () => AudioEngine | null; getFov: () => number | undefined;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);

  const releaseMic = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  const cancel = () => {
    generation.current++;
    controller.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    releaseMic();
    getEngine()?.stopAnswer();
    busy.current = false;
    setStage("idle");
    setMessage("Question cancelled.");
  };
  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const checkResponse = async (response: Response) => {
    if (response.ok) return;
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Ask is unavailable. Obstacle alerts continue.");
  };

  const submit = async (token: number, recording?: Blob) => {
    const abort = new AbortController();
    controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(VOICE_ASK.clientTimeoutMs)]);
    try {
      let text = "What's in front of me?";
      if (recording) {
        if (!recording.size || recording.size > VOICE_ASK.audioMaxBytes) throw new Error("Please record a short question and try again.");
        setStage("transcribing"); setMessage("Transcribing your question…");
        const response = await fetch("/api/ask/transcribe", { method: "POST", body: recording, headers: { "Content-Type": recording.type }, signal });
        await checkResponse(response);
        text = (await response.json()).question;
      }
      if (generation.current !== token) return;
      setQuestion(text); setStage("answering"); setMessage("Looking at the scene…");
      const frame = await session.captureFrame();
      if (generation.current !== token) return;
      if (!frame) throw new Error("No camera frame is available. Please try again.");
      const bytes = new Uint8Array(await frame.blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: btoa(binary), question: text }), signal });
      await checkResponse(response);
      const audioResponse = response.headers.get("content-type")?.startsWith("audio/");
      const meta = audioResponse ? decodeAskMeta(response.headers.get(ASK_META_HEADER)) : AskMetaSchema.parse(await response.json());
      if (!meta) throw new Error("The answer could not be read.");
      const ctx = getAudio();
      const buffer = audioResponse && ctx ? await decodeFile(ctx, await response.arrayBuffer()) : null;
      if (generation.current !== token) return;
      setAnswer(meta.answer);
      if (buffer) {
        const fov = getFov();
        const centreX = meta.box ? (meta.box[1] + meta.box[3]) / 2000 : 0.5;
        const angle = fov ? Math.atan((centreX * 2 - 1) * Math.tan(fov * Math.PI / 360)) * 180 / Math.PI : 0;
        const played = getEngine()?.playAnswer(buffer, panForAngle(angle));
        setMessage(played ? "Answer ready." : "Answer shown below. Speech paused for an obstacle warning.");
      } else {
        getEngine()?.say(["sorry"]);
        setMessage("Speech is unavailable. The answer is shown below.");
      }
    } catch (error) {
      if (generation.current === token) {
        setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Ask timed out. Please try again.");
        getEngine()?.say(["sorry"]);
      }
    } finally {
      if (generation.current === token) { busy.current = false; setStage("idle"); }
    }
  };

  const begin = async (voice: boolean) => {
    if (busy.current) return;
    if (!navigator.onLine) { setMessage("Ask is offline. Obstacle alerts still run."); getEngine()?.say(["ask_offline"]); return; }
    busy.current = true;
    const token = ++generation.current;
    setQuestion(""); setAnswer(""); setMessage("");
    getEngine()?.stopAnswer();
    void getAudio()?.resume();
    if (!voice) { await submit(token); return; }
    setStage("permission"); setMessage("Opening microphone…");
    try {
      const mimeType = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Voice recording is not supported. Use Describe ahead.");
      const input = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: microphone }, echoCancellation: true } });
      if (generation.current !== token) { input.getTracks().forEach((track) => track.stop()); return; }
      stream.current = input;
      const recording = new MediaRecorder(input, { mimeType, audioBitsPerSecond: VOICE_ASK.recordingBitsPerSecond });
      recorder.current = recording;
      const chunks: Blob[] = [];
      recording.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recording.onerror = () => {
        if (generation.current !== token) return;
        cancel(); setMessage("Microphone recording failed. Please try again.");
      };
      recording.onstop = () => {
        if (generation.current !== token) return;
        releaseMic(); recorder.current = null;
        void submit(token, new Blob(chunks, { type: mimeType }));
      };
      recording.start();
      setStage("recording"); setMessage("Listening. Tap Finish question when done.");
      timer.current = setTimeout(() => { if (recording.state === "recording") recording.stop(); }, VOICE_ASK.recordingMaxMs);
    } catch (error) {
      if (generation.current === token) {
        releaseMic();
        busy.current = false; setStage("idle"); setMessage(error instanceof Error ? error.message : "Microphone access failed.");
      }
    }
  };

  return <section aria-label="Ask about the scene" className="flex flex-col gap-3 rounded-md border border-line bg-abyss/90 p-4 text-xl text-foreground">
    <p>Stop walking to ask. Your question and one camera frame go to ElevenLabs.</p>
    {stage === "recording" ? <button type="button" onClick={() => recorder.current?.stop()} className="min-h-24 rounded-md bg-danger px-4 text-2xl font-bold text-white">Finish question</button> :
      <button type="button" disabled={stage !== "idle" || !microphone} onClick={() => void begin(true)} className="min-h-24 rounded-md bg-accent px-4 text-2xl font-bold text-on-accent disabled:opacity-50">Ask by voice</button>}
    {!microphone && <p>Set up a microphone before starting your next walk to enable voice questions.</p>}
    <button type="button" disabled={stage !== "idle"} onClick={() => void begin(false)} className="min-h-16 rounded-md border-2 border-line-strong bg-surface px-4 text-xl font-semibold disabled:opacity-50">Describe ahead</button>
    {stage !== "idle" && <button type="button" onClick={cancel} className="min-h-16 rounded-md border-2 border-line-strong bg-surface text-xl">Cancel question</button>}
    <p role="status" aria-atomic="true">{message}</p>
    {question && <p>You asked: {question}</p>}
    {answer && <p className="text-2xl font-semibold">{answer}</p>}
  </section>;
}
