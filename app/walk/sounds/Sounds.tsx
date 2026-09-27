"use client";

import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUp,
  IconPlayerStopFilled,
  IconRefresh,
  IconVolume,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DISPLAY, Name } from "@/components/brand/Display";
import { BelugaMark } from "@/components/brand/Logo";
import { SonarRings } from "@/components/brand/SonarRings";
import { AudioEngine } from "@/lib/audio/engine";
import { decodeFile, decodeLibrary, fetchLibrary, SOUNDS_PATH, type RawLibrary } from "@/lib/audio/library";
import { panForLateral, type EarSettings, type Side } from "@/lib/audio/placement";
import type { HazardUpdate } from "@/lib/shared/contracts";
import type { HazardKind, SoundId } from "@/lib/shared/enums";
import { AUDIO } from "@/lib/shared/params";
import { cn } from "@/lib/utils";
import { LINK_ROW, PANEL, PRIMARY, SECONDARY, CHECKBOX, SELECT } from "../styles";
import { readSettings } from "../settings";
import { speakText } from "../voice";

const SOUNDS: Array<{ id: SoundId; use: string }> = [
  { id: "edge_pulse", use: "drop-off" },
  { id: "head_chime", use: "head height" },
  { id: "tick", use: "obstacle" },
  { id: "ping", use: "pole" },
  { id: "bell", use: "bike" },
  { id: "marimba", use: "person" },
  { id: "buzz", use: "car, bus, truck" },
  { id: "taps", use: "blocked path" },
  { id: "listening", use: "Ask started" },
  { id: "ready", use: "app ready" },
  { id: "reported", use: "report sent" },
  { id: "centre_tick", use: "straight ahead marker" },
];

// The blindfold test uses a pole-sized offset: 0.3 m off the walking line, the middle of a real case.
const TEST_LATERAL_M = 0.3;
const TEST_CUES = 10;
const PASS_MARK = 8;
const CUE_REPEATS = 3;
const CUE_GAP_MS = 350;

const SIDES: Side[] = ["left", "ahead", "right"];
const SIDE_NAMES: Record<Side, string> = { left: "Left", ahead: "Centre", right: "Right" };
const SIDE_ICONS: Record<Side, typeof IconArrowUp> = { left: IconArrowLeft, ahead: IconArrowUp, right: IconArrowRight };

const PLAY_BUTTON = "min-h-12 rounded-md border border-line-strong bg-surface font-semibold hover:border-foreground";

function sideOfPan(pan: number): Side {
  return pan < 0 ? "left" : pan > 0 ? "right" : "ahead";
}

const CUT_CHOICES = [
  { label: "12 dB", db: 12 },
  { label: `${AUDIO.farEarCutDb} dB (default)`, db: AUDIO.farEarCutDb },
  { label: "One ear only", db: 120 },
];

function lateralFor(side: Side): number {
  return side === "left" ? -TEST_LATERAL_M : side === "right" ? TEST_LATERAL_M : 0;
}

// A hazard for the approach demo, `lateral` metres off the walking line.
function simulated(kind: HazardKind, label: HazardUpdate["label"], distance: number, lateral: number): HazardUpdate {
  return {
    id: `simulated-${kind}-${label}`,
    kind,
    distance,
    angle: (Math.atan2(lateral, distance) * 180) / Math.PI,
    label,
    blocking: 0.2,
    active: true,
    firstSeenAt: 0,
    updatedAt: 0,
  };
}

const APPROACHES: Array<{ name: string; kind: HazardKind; label: HazardUpdate["label"] }> = [
  { name: "Box", kind: "obstacle", label: "unknown" },
  { name: "Pole", kind: "obstacle", label: "pole_like" },
  { name: "Drop-off", kind: "drop_off", label: "unknown" },
  { name: "Head height", kind: "head_height", label: "unknown" },
];

const WALK_SPEED_MPS = 1.2;
const WALK_TICK_MS = 100;

interface TestState {
  cues: Side[];
  answers: Side[];
}

function randomCues(): Side[] {
  return Array.from({ length: TEST_CUES }, () => SIDES[Math.floor(Math.random() * SIDES.length)]);
}

export default function Sounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const walkRef = useRef<number | null>(null);
  const variantsRef = useRef(new Map<string, AudioBuffer>());
  const [library, setLibrary] = useState<RawLibrary | null>(null);
  const [started, setStarted] = useState(false);
  const [ears, setEars] = useState<EarSettings>({ farEarCutDb: AUDIO.farEarCutDb, maxEarDelayMs: AUDIO.maxEarDelayMs });
  const [walking, setWalking] = useState<string | null>(null);
  const [test, setTest] = useState<TestState | null>(null);

  useEffect(() => {
    void fetchLibrary(readSettings().voice).then(setLibrary);
    return () => {
      if (walkRef.current !== null) window.clearInterval(walkRef.current);
      engineRef.current?.stop();
    };
  }, []);

  // A new engine per setting, since the ears are fixed when a voice is built.
  const buildEngine = (next: EarSettings) => {
    engineRef.current?.stop();
    const ctx = (ctxRef.current ??= new AudioContext({ latencyHint: "interactive" }));
    void ctx.resume();
    const engine = new AudioEngine(ctx, { speak: speakText, ears: next });
    engine.start();
    engineRef.current = engine;
    if (library) void decodeLibrary(ctx, library).then((decoded) => engine.useLibrary(decoded));
  };

  // Any variant from the library, fetched and decoded the first time it plays.
  const playVariant = async (file: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    let buffer = variantsRef.current.get(file);
    if (!buffer) {
      const response = await fetch(`${SOUNDS_PATH}/${file}`).catch(() => null);
      const decoded = await decodeFile(ctx, response?.ok ? await response.arrayBuffer() : undefined);
      if (!decoded) return;
      buffer = decoded;
      variantsRef.current.set(file, buffer);
    }
    engineRef.current?.playBuffer(buffer, 0);
  };

  const start = () => {
    buildEngine(ears);
    setStarted(true);
  };

  const changeEars = (next: EarSettings) => {
    setEars(next);
    if (started) buildEngine(next);
  };

  const stopWalk = () => {
    if (walkRef.current !== null) window.clearInterval(walkRef.current);
    walkRef.current = null;
    engineRef.current?.update([], { speed: 0, stationary: false });
    setWalking(null);
  };

  // Walks up to a hazard from 3.5 m to 0.3 m at 1.2 m/s, through the real scheduler.
  const walkUp = (approach: (typeof APPROACHES)[number], side: Side) => {
    stopWalk();
    let distance = 3.5;
    const lateral = lateralFor(side);
    setWalking(`${approach.name}, ${SIDE_NAMES[side].toLowerCase()}`);
    walkRef.current = window.setInterval(() => {
      distance -= (WALK_SPEED_MPS * WALK_TICK_MS) / 1000;
      if (distance < 0.3) {
        stopWalk();
        return;
      }
      const hazard = simulated(approach.kind, approach.label, distance, lateral);
      engineRef.current?.update([hazard], { speed: WALK_SPEED_MPS, stationary: false });
    }, WALK_TICK_MS);
  };

  // A cue sounds like a real warning: three ticks from the side, with the centre marker when ahead.
  const playCue = (side: Side) => {
    const pan = panForLateral(lateralFor(side));
    for (let i = 0; i < CUE_REPEATS; i++) {
      window.setTimeout(() => {
        engineRef.current?.play("tick", pan);
        if (side === "ahead") engineRef.current?.play("centre_tick", 0);
      }, i * CUE_GAP_MS);
    }
  };

  const startTest = () => {
    stopWalk();
    const cues = randomCues();
    setTest({ cues, answers: [] });
    playCue(cues[0]);
  };

  const answer = (side: Side) => {
    if (!test || test.answers.length >= test.cues.length) return;
    const answers = [...test.answers, side];
    setTest({ ...test, answers });
    if (answers.length < test.cues.length) {
      window.setTimeout(() => playCue(test.cues[answers.length]), 800);
      return;
    }
    const correct = answers.filter((a, i) => a === test.cues[i]).length;
    // Lands in the dev server terminal (or Vercel logs) as a [beluga sounds] line.
    void fetch("/api/device-check", {
      method: "POST",
      body: JSON.stringify({
        kind: "sounds",
        correct,
        total: test.cues.length,
        lateralM: TEST_LATERAL_M,
        farEarCutDb: ears.farEarCutDb,
        maxEarDelayMs: ears.maxEarDelayMs,
        cues: test.cues,
        answers,
      }),
    }).catch(() => {});
  };

  const testing = test !== null && test.answers.length < test.cues.length;
  const correct = test ? test.answers.filter((a, i) => a === test.cues[i]).length : 0;

  if (testing) {
    return (
      <main className="flex min-h-dvh flex-col gap-3 bg-background px-3 pt-safe pb-safe text-foreground">
        <p role="status" className="px-2 pt-3 text-center text-xl font-semibold">
          Cue {test.answers.length + 1} of {test.cues.length}. Tap the side you heard.
        </p>
        <div aria-hidden className="mx-2 h-2 overflow-hidden bg-line">
          <div
            className="h-full bg-accent"
            style={{ width: `${(test.answers.length / test.cues.length) * 100}%` }}
          />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2">
          {SIDES.map((side) => {
            const Icon = SIDE_ICONS[side];
            return (
              <button
                key={side}
                type="button"
                onClick={() => answer(side)}
                className="flex flex-col items-center justify-center gap-3 rounded-md border border-line-strong bg-surface text-2xl font-bold active:bg-accent active:text-on-accent"
              >
                <Icon aria-hidden size={40} stroke={1.75} />
                {SIDE_NAMES[side]}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => playCue(test.cues[test.answers.length])} className={SECONDARY}>
          <IconRefresh aria-hidden size={24} />
          Play it again
        </button>
      </main>
    );
  }

  return (
    <main className="group/sounds mx-auto flex w-full max-w-xl flex-col gap-5 bg-background px-4 pt-safe pb-12 text-foreground">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <BelugaMark size={64} className="size-14" />
          <h1 className={cn(DISPLAY, "text-4xl sm:text-5xl")}>
            <Name /> sounds
          </h1>
        </div>
        <p className="text-lg text-muted">
          Plays every warning sound through the earbuds, left, centre and right, and runs the blindfold test.{" "}
          {library
            ? `Sounds from the ElevenLabs library, made ${new Date(library.manifest.generatedAt).toLocaleString("en-CA")}.`
            : "No ElevenLabs library yet (run npm run sounds), so these are temporary tones."}
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-background px-4 pt-safe pb-3">
        <HeadFromAbove />
      </div>

      {!started ? (
        <button type="button" onClick={start} className={cn(PRIMARY, "min-h-24 text-2xl")}>
          <IconVolume aria-hidden size={28} />
          Start sound
        </button>
      ) : (
        <>
          <section className={cn(PANEL, "flex flex-col gap-3")}>
            <h2 className={cn(DISPLAY, "text-2xl sm:text-3xl")}>Ears</h2>
            <label className="flex flex-col gap-2 text-lg">
              Far ear at full pan: how much quieter
              <select
                value={ears.farEarCutDb}
                onChange={(e) => changeEars({ ...ears, farEarCutDb: Number(e.target.value) })}
                className={SELECT}
              >
                {CUT_CHOICES.map((c) => (
                  <option key={c.db} value={c.db}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-12 items-center gap-4 text-lg">
              <input
                type="checkbox"
                checked={ears.maxEarDelayMs > 0}
                onChange={(e) => changeEars({ ...ears, maxEarDelayMs: e.target.checked ? AUDIO.maxEarDelayMs : 0 })}
                className={CHECKBOX}
              />
              Far ear hears it up to {AUDIO.maxEarDelayMs} ms later
            </label>
          </section>

          <section className={cn(PANEL, "flex flex-col gap-3")}>
            <h2 className={cn(DISPLAY, "text-2xl sm:text-3xl")}>Blindfold test</h2>
            <p className="text-lg text-muted">
              {TEST_CUES} random cues from a pole {TEST_LATERAL_M} m left, ahead or {TEST_LATERAL_M} m right. The wearer
              taps the side. The plan asks for {PASS_MARK} of {TEST_CUES}.
            </p>
            {test && (
              <p role="status" className="font-mono text-lg font-medium">
                Last test: {correct} of {test.cues.length} correct, {correct >= PASS_MARK ? "pass" : "not yet"}
              </p>
            )}
            <button type="button" onClick={startTest} className={PRIMARY}>
              Start the blindfold test
            </button>
          </section>

          <section className={cn(PANEL, "flex flex-col gap-3")}>
            <h2 className={cn(DISPLAY, "text-2xl sm:text-3xl")}>Walk up to it (simulated)</h2>
            <p className="text-lg text-muted">
              A simulated hazard from 3.5 m to 0.3 m at walking pace, through the real warning rules.
            </p>
            {walking && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-line-strong bg-abyss p-2 pl-4">
                <p role="status" className="text-lg">
                  Playing: {walking}
                </p>
                <button
                  type="button"
                  onClick={stopWalk}
                  className="flex min-h-12 items-center gap-2 rounded-md bg-danger px-4 font-semibold text-white"
                >
                  <IconPlayerStopFilled aria-hidden size={18} />
                  Stop
                </button>
              </div>
            )}
            {APPROACHES.map((approach) => (
              <div key={approach.name} className="grid grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)] items-center gap-2">
                <span className="text-lg">{approach.name}</span>
                {SIDES.map((side) => (
                  <button
                    key={side}
                    type="button"
                    data-side={side}
                    onClick={() => walkUp(approach, side)}
                    className={PLAY_BUTTON}
                  >
                    {SIDE_NAMES[side]}
                  </button>
                ))}
              </div>
            ))}
          </section>

          <section className={cn(PANEL, "flex flex-col gap-3")}>
            <h2 className={cn(DISPLAY, "text-2xl sm:text-3xl")}>Each sound</h2>
            {library && (
              <p className="text-lg text-muted">
                Numbered buttons play each ElevenLabs variant from the centre. To pick one, set its file in{" "}
                <code>public/sounds/manifest.json</code>.
              </p>
            )}
            {SOUNDS.map(({ id, use }) => (
              <div key={id} className="flex flex-col gap-1">
                <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,4.5rem)] items-center gap-2">
                  <span>
                    <span className="font-mono wrap-anywhere">{id}</span>
                    <br />
                    <span className="text-muted">{use}</span>
                  </span>
                  {([-1, 0, 1] as const).map((pan) => (
                    <button
                      key={pan}
                      type="button"
                      data-side={sideOfPan(pan)}
                      onClick={() => engineRef.current?.play(id, pan)}
                      className={PLAY_BUTTON}
                    >
                      {pan < 0 ? "Left" : pan > 0 ? "Right" : "Centre"}
                    </button>
                  ))}
                </div>
                <Variants files={library?.manifest.sounds[id]} onPlay={(file) => void playVariant(file)} />
              </div>
            ))}
          </section>
        </>
      )}

      <Link href="/walk" className={cn(LINK_ROW, "justify-start")}>
        <IconArrowLeft aria-hidden size={24} className="shrink-0" />
        Back to beluga
      </Link>
    </main>
  );
}

// One button per library variant and loop, with the one that plays in a walk marked.
function Variants({
  files,
  onPlay,
}: {
  files: { file: string; variants: string[]; loop: string | null; loopVariants: string[] } | undefined;
  onPlay: (file: string) => void;
}) {
  if (!files) return null;
  const all = [
    ...files.variants.map((file, i) => ({ file, name: `${i + 1}`, chosen: file === files.file })),
    ...files.loopVariants.map((file, i) => ({ file, name: `loop ${i + 1}`, chosen: file === files.loop })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {all.map(({ file, name, chosen }) => (
        <button
          key={file}
          type="button"
          data-side="ahead"
          onClick={() => onPlay(file)}
          className={cn(
            "min-h-12 min-w-12 rounded-md px-3",
            chosen ? "bg-accent font-bold text-on-accent" : "border border-line-strong bg-surface",
          )}
        >
          {name}
          {chosen && " (in use)"}
        </button>
      ))}
    </div>
  );
}

// Where the dot in the head goes for each side, as custom properties the figure reads. Every play
// button carries `data-side`, and the dot follows the one last tapped or focused, so the sound
// code stays as it is.
const DOT_AT = [
  "[--dot-x:50%] [--dot-y:70%] [--dot-on:0] [--ear-l:0] [--ear-r:0]",
  "group-has-[[data-side=left]:is(:focus,:hover)]/sounds:[--dot-x:17.6%]",
  "group-has-[[data-side=left]:is(:focus,:hover)]/sounds:[--dot-y:40%]",
  "group-has-[[data-side=left]:is(:focus,:hover)]/sounds:[--dot-on:1]",
  "group-has-[[data-side=left]:is(:focus,:hover)]/sounds:[--ear-l:1]",
  "group-has-[[data-side=ahead]:is(:focus,:hover)]/sounds:[--dot-x:50%]",
  "group-has-[[data-side=ahead]:is(:focus,:hover)]/sounds:[--dot-y:10%]",
  "group-has-[[data-side=ahead]:is(:focus,:hover)]/sounds:[--dot-on:1]",
  "group-has-[[data-side=ahead]:is(:focus,:hover)]/sounds:[--ear-l:1]",
  "group-has-[[data-side=ahead]:is(:focus,:hover)]/sounds:[--ear-r:1]",
  "group-has-[[data-side=right]:is(:focus,:hover)]/sounds:[--dot-x:82.4%]",
  "group-has-[[data-side=right]:is(:focus,:hover)]/sounds:[--dot-y:40%]",
  "group-has-[[data-side=right]:is(:focus,:hover)]/sounds:[--dot-on:1]",
  "group-has-[[data-side=right]:is(:focus,:hover)]/sounds:[--ear-r:1]",
].join(" ");

const SPOTS = [
  { name: "Left", x: "17.6%", y: "40%", label: "top-[40%] right-[calc(82.4%+1.25rem)] -translate-y-1/2" },
  { name: "Centre", x: "50%", y: "10%", label: "top-[10%] left-[calc(50%+1.25rem)] -translate-y-1/2" },
  { name: "Right", x: "82.4%", y: "40%", label: "top-[40%] left-[calc(82.4%+1.25rem)] -translate-y-1/2" },
];

const FADE = "transition-opacity duration-300 ease-water motion-reduce:transition-none";

// A head seen from above, nose up, with the earbuds on each side. Decoration: each button already
// says its side in words.
function HeadFromAbove() {
  return (
    <div aria-hidden className={cn("relative mx-auto h-40 w-64", DOT_AT)}>
      <span className="absolute top-[70%] left-1/2 size-48 -translate-1/2 rounded-full border-2 border-dashed border-line [clip-path:inset(0_0_50%_0)]" />
      {SPOTS.map((spot) => (
        <span key={spot.name}>
          <span
            className="absolute size-6 -translate-1/2 rounded-full border-2 border-line-strong"
            style={{ left: spot.x, top: spot.y }}
          />
          <span className={cn("absolute text-sm text-muted", spot.label)}>{spot.name}</span>
        </span>
      ))}
      <span className="absolute top-[70%] left-[37.5%] h-7 w-3 -translate-1/2 rounded-full bg-line-strong">
        <span className={cn("absolute inset-0 rounded-full bg-sonar opacity-(--ear-l)", FADE)} />
      </span>
      <span className="absolute top-[70%] left-[62.5%] h-7 w-3 -translate-1/2 rounded-full bg-line-strong">
        <span className={cn("absolute inset-0 rounded-full bg-sonar opacity-(--ear-r)", FADE)} />
      </span>
      <span className="absolute top-[46%] left-1/2 size-4 -translate-1/2 rotate-45 border-t-2 border-l-2 border-foreground/80 bg-background" />
      <span className="absolute top-[70%] left-1/2 h-[76px] w-16 -translate-1/2 rounded-[50%] border-2 border-foreground/80 bg-background" />
      <span className="absolute top-(--dot-y) left-(--dot-x) size-6 -translate-1/2 opacity-(--dot-on) transition-[left,top,opacity] duration-300 ease-water motion-reduce:transition-none">
        <SonarRings className="top-1/2 left-1/2 size-16 -translate-1/2" count={2} duration={1.6} />
        <span className="absolute inset-0 rounded-full bg-sonar" />
      </span>
    </div>
  );
}
