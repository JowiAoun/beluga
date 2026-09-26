"use client";
import { IconArrowLeft, IconArrowRight, IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/engine";
import { decodeLibrary, fetchLibrary, type ClipId, type RawLibrary } from "@/lib/audio/library";
import type { SoundId } from "@/lib/shared/enums";
import { PRACTICE } from "@/lib/shared/params";
import { DISPLAY, Name } from "@/components/brand/Display";
import { BelugaMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { CHECKBOX, LINK_ROW, PANEL, SECONDARY } from "../styles";
import { speakLocalText } from "../voice";
import VibrationControls from "../VibrationControls";
import { DEFAULT_SETTINGS, readSettings, saveSettings } from "../settings";
import { deviceVibrate } from "@/lib/haptics/engine";

const LESSONS: { title: string; sound: SoundId; word?: ClipId; explanation: string }[] = [
  { title: "Head-height obstacle", sound: "head_chime", word: "head", explanation: "Two rising notes mean an obstacle near your head." },
  { title: "Edge or drop-off", sound: "edge_pulse", word: "edge", explanation: "A falling tone warns of a possible drop in the ground ahead." },
  { title: "Blocked path", sound: "taps", word: "blocked", explanation: "Three taps mean an obstacle covers much of the walking corridor." },
  { title: "Other obstacle", sound: "tick", explanation: "A short wooden tick means an obstacle in your walking corridor." },
  { title: "Pole", sound: "ping", word: "pole", explanation: "A metallic ping marks a narrow, pole-like obstacle." },
  { title: "Bicycle", sound: "bell", word: "bike", explanation: "A double bell is the cue for a bicycle or motorcycle." },
  { title: "Person", sound: "marimba", word: "person", explanation: "A soft marimba note is the cue for a person." },
  { title: "Vehicle", sound: "buzz", word: "car", explanation: "A brief buzz is the cue for a car, bus or truck." },
];
const SIDES = [{ name: "Left", word: "left", pan: -1 }, { name: "Ahead", word: "ahead", pan: 0 }, { name: "Right", word: "right", pan: 1 }] as const;
const SIDE_ICONS = { left: IconArrowLeft, ahead: IconArrowUp, right: IconArrowRight } as const;

export default function Practice() {
  const ctx = useRef<AudioContext | null>(null);
  const engine = useRef<AudioEngine | null>(null);
  const raw = useRef<RawLibrary | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const token = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Preparing practice sounds…");
  const [fast, setFast] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const stop = () => {
    deviceVibrate(0);
    token.current++;
    timers.current.forEach(clearTimeout); timers.current = [];
    engine.current?.stop(); engine.current = null;
    window.speechSynthesis?.cancel();
  };
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setSettings(readSettings()); });
    void fetchLibrary().then((library) => {
      if (!active) return;
      raw.current = library; setLoaded(true);
      setMessage("Choose a sound and direction to practice. All examples are simulated.");
    });
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { active = false; stop(); void ctx.current?.close(); document.removeEventListener("visibilitychange", hide); };
  }, []);

  const play = async (lesson: typeof LESSONS[number], side: typeof SIDES[number], labelOnly = false) => {
    stop(); const mine = token.current;
    try {
      const context = ctx.current ??= new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      const sound = new AudioEngine(context, { speak: speakLocalText });
      engine.current = sound;
      if (raw.current) sound.useLibrary(await decodeLibrary(context, raw.current));
      if (token.current !== mine) { sound.stop(); return; }
      setMessage(`Simulated ${lesson.title.toLowerCase()}, ${side.name.toLowerCase()}. ${labelOnly ? "Spoken label." : lesson.explanation}`);
      if (labelOnly && lesson.word) { sound.say([lesson.word, side.word], side.pan); return; }
      for (let i = 0; i < PRACTICE.repeats; i++) {
        timers.current.push(setTimeout(() => {
          if (token.current !== mine) return;
          sound.play(lesson.sound, side.pan);
          if (side.pan === 0) sound.play("centre_tick");
        }, i * PRACTICE.repeatGapMs / (fast ? 2 : 1)));
      }
    } catch { setMessage("Audio could not start. Tap a sound to try again."); }
  };

  return <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pt-8 pb-12">
    <div className="flex items-center gap-3"><BelugaMark size={64} className="size-14" /><h1 className={cn(DISPLAY, "text-4xl sm:text-5xl")}>Learn <Name /><span className="normal-case">’s</span> sounds</h1></div>
    <p className="self-start rounded-md bg-accent px-3 py-1 text-base font-bold text-on-accent">Audio practice · Simulated examples</p>
    <p className="text-xl text-muted">Practice while standing still. Listen through your earbuds. Left and right cues indicate the obstacle’s side. Faster repeats mean it is closer.</p>
    <p className="text-lg text-muted">No camera or microphone is used in practice. These examples do not detect anything around you.</p>
    <section className={PANEL}>
      <VibrationControls practice settings={settings} onChange={(next) => {
        const updated = { ...readSettings(), ...next };
        setSettings(updated); saveSettings(updated);
      }} />
    </section>
    <p role="status" aria-atomic="true" className="rounded-md border border-line-strong bg-surface p-4 text-xl text-foreground">{message}</p>
    <label className="flex min-h-16 items-center gap-4 text-lg"><input type="checkbox" checked={fast} onChange={(event) => setFast(event.target.checked)} className={CHECKBOX} />Practice faster repeats (closer obstacle)</label>
    <button type="button" onClick={() => { stop(); setMessage("Practice audio stopped."); }} className={SECONDARY}><IconPlayerStopFilled aria-hidden size={22} />Stop practice audio</button>
    {LESSONS.map((lesson) => <section key={lesson.sound} className={cn(PANEL, "flex flex-col gap-3")}>
      <h2 className={cn(DISPLAY, "text-2xl sm:text-3xl")}>{lesson.title}</h2><p className="text-lg text-muted">{lesson.explanation}</p>
      <div className="grid grid-cols-3 gap-2">{SIDES.map((side) => { const Icon = SIDE_ICONS[side.word]; return <button key={side.word} type="button" disabled={!loaded} aria-label={`Play simulated ${lesson.title.toLowerCase()} on the ${side.name.toLowerCase()} side`} onClick={() => void play(lesson, side)} className={cn(SECONDARY, "gap-1.5 px-2 text-lg")}><Icon aria-hidden size={20} className="shrink-0 text-sonar" />{side.name}</button>; })}</div>
      {lesson.word && <button type="button" disabled={!loaded} onClick={() => void play(lesson, SIDES[1], true)} className={cn(SECONDARY, "border-dashed text-lg font-semibold")}>Hear spoken label: {lesson.word}</button>}
    </section>)}
    <Link href="/walk" className={cn(LINK_ROW, "justify-start")}><IconArrowLeft aria-hidden size={24} className="shrink-0" />Back to walking setup</Link>
  </main>;
}
