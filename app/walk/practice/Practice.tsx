"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/lib/audio/engine";
import { decodeLibrary, fetchLibrary, type ClipId, type RawLibrary } from "@/lib/audio/library";
import type { SoundId } from "@/lib/shared/enums";
import { PRACTICE } from "@/lib/shared/params";
import { speakLocalText } from "../voice";

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

export default function Practice() {
  const ctx = useRef<AudioContext | null>(null);
  const engine = useRef<AudioEngine | null>(null);
  const raw = useRef<RawLibrary | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const token = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Preparing practice sounds…");
  const [fast, setFast] = useState(false);

  const stop = () => {
    token.current++;
    timers.current.forEach(clearTimeout); timers.current = [];
    engine.current?.stop(); engine.current = null;
    window.speechSynthesis?.cancel();
  };
  useEffect(() => {
    let active = true;
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

  return <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 p-4">
    <h1 className="text-3xl font-bold">Learn beluga’s sounds</h1>
    <p className="text-lg">Audio practice · Simulated examples</p>
    <p>Practice while standing still. Listen through your earbuds. Left and right cues indicate the obstacle’s side. Faster repeats mean it is closer.</p>
    <p>No camera or microphone is used in practice. These examples do not detect anything around you.</p>
    <p role="status" aria-atomic="true" className="rounded-lg bg-slate-900 p-4 text-lg text-white">{message}</p>
    <label className="flex min-h-16 items-center gap-3"><input type="checkbox" checked={fast} onChange={(event) => setFast(event.target.checked)} className="h-6 w-6" />Practice faster repeats (closer obstacle)</label>
    <button type="button" onClick={() => { stop(); setMessage("Practice audio stopped."); }} className="min-h-16 rounded-lg border-2 border-white text-xl font-bold">Stop practice audio</button>
    {LESSONS.map((lesson) => <section key={lesson.sound} className="flex flex-col gap-3 rounded-xl border border-slate-500 p-4">
      <h2 className="text-2xl font-bold">{lesson.title}</h2><p>{lesson.explanation}</p>
      <div className="grid grid-cols-3 gap-2">{SIDES.map((side) => <button key={side.word} type="button" disabled={!loaded} aria-label={`Play simulated ${lesson.title.toLowerCase()} on the ${side.name.toLowerCase()} side`} onClick={() => void play(lesson, side)} className="min-h-16 rounded-lg bg-yellow-300 px-2 text-lg font-semibold text-black disabled:opacity-50">{side.name}</button>)}</div>
      {lesson.word && <button type="button" disabled={!loaded} onClick={() => void play(lesson, SIDES[1], true)} className="min-h-16 rounded-lg border-2 border-white font-semibold">Hear spoken label: {lesson.word}</button>}
    </section>)}
    <Link href="/walk" className="flex min-h-16 items-center justify-center rounded-lg bg-yellow-300 text-xl font-bold text-black">Back to walking setup</Link>
  </main>;
}
