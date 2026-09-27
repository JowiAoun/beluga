"use client";

// The five voices, in setup and in Settings: each with its name, how it sounds, and a Play button
// for a short sample in its own manner. The picked voice says the warning words and Ask's answers.

import { IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-react";
import { useEffect, useId, useRef, useState } from "react";
import { SOUNDS_PATH } from "@/lib/audio/library";
import { samplePath, VOICES, type VoiceKey } from "@/lib/audio/voices";
import { cn } from "@/lib/utils";
import { CHECKBOX } from "./styles";
import { stopRecording } from "./voice";

export default function VoicePicker({
  value,
  onChange,
  legend,
}: {
  value: VoiceKey;
  onChange: (voice: VoiceKey) => void;
  legend: string;
}) {
  const [playing, setPlaying] = useState<VoiceKey | null>(null);
  const [message, setMessage] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const name = useId();

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  };

  useEffect(() => () => audio.current?.pause(), []);

  const play = (key: VoiceKey) => {
    const wasPlaying = playing === key;
    stop();
    if (wasPlaying) return;
    // A setup step may still be playing, as a recording or in the phone's own voice.
    stopRecording();
    window.speechSynthesis?.cancel();
    const sample = new Audio(`${SOUNDS_PATH}/${samplePath(key)}`);
    sample.onended = () => setPlaying((now) => (now === key ? null : now));
    audio.current = sample;
    setPlaying(key);
    setMessage("");
    sample.play().catch(() => {
      setPlaying(null);
      setMessage("This sample needs a connection the first time it plays.");
    });
  };

  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2 text-lg font-semibold">{legend}</legend>
      {VOICES.map((voice) => (
        <div key={voice.key} className="flex items-center gap-3 border-t border-line py-2">
          <label className="flex min-h-16 flex-1 items-center gap-4">
            <input
              type="radio"
              name={name}
              value={voice.key}
              checked={value === voice.key}
              onChange={() => onChange(voice.key)}
              className={CHECKBOX}
            />
            <span className="flex flex-col">
              <span className={cn("text-xl font-semibold", value === voice.key && "text-sonar")}>{voice.name}</span>
              <span className="text-base text-muted">{voice.tone}</span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => play(voice.key)}
            aria-label={playing === voice.key ? `Stop ${voice.name}'s sample` : `Play ${voice.name}'s sample`}
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-md border border-line-strong px-4 text-lg font-semibold hover:border-foreground"
          >
            {playing === voice.key ? (
              <IconPlayerStopFilled aria-hidden size={20} />
            ) : (
              <IconPlayerPlayFilled aria-hidden size={20} />
            )}
            {playing === voice.key ? "Stop" : "Play"}
          </button>
        </div>
      ))}
      <p role="status" className="mt-2 text-base text-muted empty:hidden">
        {message}
      </p>
    </fieldset>
  );
}
