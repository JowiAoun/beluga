"use client";
import { useEffect, useRef, useState } from "react";

export default function MicrophoneSetup({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const enable = async () => {
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Recording is not supported in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission only: release the microphone immediately, including if AR has already started.
      stream.getTracks().forEach((track) => track.stop());
      if (!alive.current) return;
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
      if (!alive.current) return;
      setDevices(inputs);
      setMessage("Choose the phone microphone below. It will only record when you tap Ask by voice.");
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error ? error.message : "Microphone permission was not granted.");
    } finally { if (alive.current) setBusy(false); }
  };
  return <section className="flex flex-col gap-3 rounded-lg border border-slate-500 p-4">
    <h2 className="text-xl font-bold">Voice questions (optional)</h2>
    <p>Ask sends your recorded question and one camera frame to ElevenLabs. beluga does not save them.</p>
    <p>Choose the phone microphone. A Bluetooth microphone can make warning sounds mono while recording. Stop walking to ask a question.</p>
    <button type="button" disabled={busy} onClick={() => void enable()} className="min-h-16 rounded-lg border-2 border-yellow-300 p-3 font-semibold disabled:opacity-50">
      {busy ? "Requesting microphone…" : "Set up microphone"}
    </button>
    {devices.length > 0 && <label className="flex flex-col gap-2">Microphone
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-16 rounded bg-slate-900 px-3 text-white">
        <option value="">Voice questions off</option>
        {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
      </select>
    </label>}
    <p role="status">{message}</p>
  </section>;
}
