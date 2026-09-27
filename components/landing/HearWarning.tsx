"use client";

import { IconArrowLeft, IconArrowRight, IconArrowUp, IconHeadphones, IconPlayerStopFilled } from "@tabler/icons-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/brand/Button";
import { DISPLAY, Eyebrow, Serif } from "@/components/brand/Display";
import { LiveContours } from "@/components/brand/LiveContours";
import { usePaused } from "@/components/brand/MotionPrefs";
import { Reveal, RevealHeading } from "@/components/brand/Reveal";
import { SonarRings } from "@/components/brand/SonarRings";
import { SceneSlot } from "@/components/three/SceneSlot";
import { decodeFile, SOUNDS_PATH, type LibraryManifest } from "@/lib/audio/library";
import { createPlacer, type Side } from "@/lib/audio/placement";
import type { SoundId } from "@/lib/shared/enums";
import { cn } from "@/lib/utils";

const EarbudsScene = dynamic(() => import("@/components/three/EarbudsScene"), { ssr: false });

type ClipWord = "pole" | "step_down" | "head";

const WARNINGS: {
  side: Side;
  pan: number;
  sound: SoundId;
  word: ClipWord;
  caption: string;
  Icon: typeof IconArrowLeft;
}[] = [
  { side: "left", pan: -1, sound: "ping", word: "pole", caption: "Left: pole, 2 m", Icon: IconArrowLeft },
  {
    side: "ahead",
    pan: 0,
    sound: "edge_pulse",
    word: "step_down",
    caption: "Ahead: step down, 3 m",
    Icon: IconArrowUp,
  },
  {
    side: "right",
    pan: 1,
    sound: "head_chime",
    word: "head",
    caption: "Right: head-height sign, 1.5 m",
    Icon: IconArrowRight,
  },
];

// Seconds between the repeats of one warning, getting faster as the obstacle gets closer.
const REPEATS = [0, 0.62, 1.08];
const WORD_AT = 1.5;
const STEP_SECONDS = 2.6;
// Starts quiet: people press play with headphones already on.
const START_GAIN = 0.35;

// Where each contact pad sits on the still, as a share of its width and height.
const PAD_SPOTS = { left: ["33.5%", "41%"], right: ["66.5%", "40%"] } as const;

// The still shown first, and in place of the 3D earbuds with reduced motion or no WebGL2. The
// pad on the playing side glows here too.
function EarbudsPoster({ side }: { side: Side | null }) {
  return (
    <>
      <Image src="/3d/trekz-air.webp" alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain" />
      {(["left", "right"] as const).map((pad) => (
        <span
          key={pad}
          aria-hidden
          className={cn(
            "absolute size-[7%] -translate-1/2 rounded-full bg-accent ring-8 ring-accent/30 transition-opacity duration-300",
            side === pad || side === "ahead" ? "opacity-100" : "opacity-0",
          )}
          style={{ left: PAD_SPOTS[pad][0], top: PAD_SPOTS[pad][1] }}
        />
      ))}
    </>
  );
}

export function HearWarning() {
  const paused = usePaused();
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState("");
  const stopRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
    setActive(null);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(async () => {
    // Made inside the tap, or Safari and Chrome keep it silent.
    const ctx = new AudioContext();
    const master = new GainNode(ctx, { gain: START_GAIN });
    master.connect(ctx.destination);
    const timers: number[] = [];
    let stopped = false;
    stopRef.current = () => {
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
      void ctx.close();
    };
    setPlaying(true);
    setCaption("Loading the sounds…");

    try {
      const manifest = (await (await fetch(`${SOUNDS_PATH}/manifest.json`)).json()) as LibraryManifest;
      const load = async (file: string | undefined) =>
        file ? decodeFile(ctx, await (await fetch(`${SOUNDS_PATH}/${file}`)).arrayBuffer()) : null;
      const buffers = await Promise.all(
        WARNINGS.map(async (w) => ({
          sound: await load(manifest.sounds[w.sound]?.file),
          word: await load(manifest.clips[w.word]?.file),
        })),
      );
      if (stopped) return;
      if (buffers.some((b) => !b.sound)) throw new Error("missing sound");

      const start = ctx.currentTime + 0.15;
      WARNINGS.forEach((warning, i) => {
        const at = start + i * STEP_SECONDS;
        const placer = createPlacer(ctx, master, warning.pan);
        for (const offset of REPEATS) {
          const source = new AudioBufferSourceNode(ctx, { buffer: buffers[i].sound });
          source.connect(placer.input);
          source.start(at + offset);
        }
        if (buffers[i].word) {
          const source = new AudioBufferSourceNode(ctx, { buffer: buffers[i].word });
          source.connect(placer.input);
          source.start(at + WORD_AT);
        }
        timers.push(
          window.setTimeout(
            () => {
              setActive(i);
              setCaption(warning.caption);
            },
            (at - ctx.currentTime) * 1000,
          ),
        );
      });
      timers.push(
        window.setTimeout(
          () => {
            stop();
            setCaption("Done. Press play to hear it again.");
          },
          (start + WARNINGS.length * STEP_SECONDS - ctx.currentTime) * 1000,
        ),
      );
    } catch {
      if (stopped) return;
      stop();
      setCaption("The sounds didn't load. Check your connection and try again.");
    }
  }, [stop]);

  const side = active === null ? null : WARNINGS[active].side;

  return (
    <section
      id="hear"
      aria-labelledby="hear-title"
      className="tone-paper relative isolate overflow-hidden px-4 pb-24 sm:px-6 md:pb-36"
    >
      <LiveContours variant="b" />
      <div className="relative mx-auto max-w-7xl border-t border-line pt-20 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Hear it</Eyebrow>
            <RevealHeading id="hear-title" lines={["Hear a", <Serif key="w">warning</Serif>]} className="mt-5 text-section" />
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[60ch] text-lg text-muted">
                Put your headphones on. beluga plays three warnings, one from each side, the way the bone-conduction
                earbuds would. Each sound repeats faster as the obstacle gets closer, then says what it is.
              </p>
            </Reveal>

            <Reveal delay={0.2} className="mt-8 flex flex-wrap items-center gap-3">
              {/* One button for both, so keyboard focus stays on it. */}
              <Button
                size="lg"
                variant={playing ? "secondary" : "primary"}
                onClick={playing ? stop : play}
                className="w-full sm:w-auto"
              >
                {playing ? <IconPlayerStopFilled aria-hidden size={22} /> : <IconHeadphones aria-hidden size={24} />}
                {playing ? "Stop" : "Hear a warning (headphones on)"}
              </Button>
            </Reveal>

            <p aria-live="polite" className="mt-4 min-h-7 font-mono text-lg">
              {caption}
            </p>
          </div>

          <SceneSlot poster={<EarbudsPoster side={side} />} className="mx-auto aspect-square w-full max-w-xl">
            {(controls) => <EarbudsScene side={side} still={paused} {...controls} />}
          </SceneSlot>
        </div>

        {/* The side that is playing fills blue, and its word says which side it is. */}
        <ol className="mt-14 grid border-t border-line sm:grid-cols-3">
          {WARNINGS.map((w, i) => (
            <li
              key={w.side}
              className={cn(
                "relative flex flex-col gap-3 overflow-hidden border-b border-line px-5 py-8 transition-colors duration-300 ease-water sm:border-b-0 sm:px-6 sm:[&:not(:first-child)]:border-l",
                active === i && "bg-accent text-on-accent",
              )}
            >
              {active === i && !paused && (
                <SonarRings className="-top-10 -right-10 size-32" count={2} duration={1.2} colour="var(--on-accent)" />
              )}
              <span className="flex items-start justify-between gap-3">
                <span className={cn(DISPLAY, "text-[clamp(3rem,6.5vw,6rem)] leading-[0.85] tracking-[-0.04em]")}>
                  {w.caption.split(":")[0]}
                </span>
                <w.Icon aria-hidden size={40} className={active === i ? "text-on-accent" : "text-sonar"} />
              </span>
              <span className={cn("text-lg", active === i ? "text-on-accent" : "text-muted")}>
                {w.caption.split(": ")[1]}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
