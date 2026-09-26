"use client";

// The four steps as outline cards in a staggered row, each with its picture on top. Step 1 is
// the phone in 3D with its walking corridor.

import dynamic from "next/dynamic";
import { Eyebrow, Serif } from "@/components/brand/Display";
import { usePaused } from "@/components/brand/MotionPrefs";
import { NotchCard } from "@/components/brand/NotchCard";
import { Reveal, RevealHeading } from "@/components/brand/Reveal";
import { SceneSlot } from "@/components/three/SceneSlot";
import { DepthScene, SCENES } from "./StepScenes";

const PhoneScene = dynamic(() => import("@/components/three/PhoneScene"), { ssr: false });

// Step 1 in 3D: the phone and the corridor from its camera. The drawing shows first, and stays
// with reduced motion or no WebGL2. The scene only draws while it is on screen.
function DepthStep({ id }: { id: string }) {
  const paused = usePaused();
  return (
    <SceneSlot poster={<DepthScene id={id} />} className="size-full">
      {(controls) => <PhoneScene still={paused} active {...controls} />}
    </SceneSlot>
  );
}

const STEPS = [
  {
    tab: "Depth",
    title: "Depth on the phone",
    text: "Chrome's WebXR and ARCore depth measure everything in a narrow walking corridor, ten times a second. This part never touches the network.",
  },
  {
    tab: "Sound",
    title: "Sounds from the obstacle's side",
    text: "A short sound plays from the side of what is in the way and repeats faster as it gets closer, made for bone-conduction earbuds that keep the ears open to traffic. Drop-offs and head-height hazards have their own sounds.",
  },
  {
    tab: "Ask",
    title: "Ask, and civic triage",
    text: "A tap on Ask sends one camera frame to an ElevenLabs agent that sees with Gemini, and the answer is spoken from the object's side. The same kind of agent answers questions about lasting hazards, and fixed rules decide what gets reported.",
  },
  {
    tab: "City",
    title: "A fix-first list for the city",
    text: "With consent, anonymous reports rounded to about 100 m land in Tiger Data. Continuous aggregates rank the spots worth fixing first around Ottawa's O-Train stations.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="tone-ink relative isolate rounded-b-[50%_4rem] px-4 pt-24 pb-36 sm:px-6 md:rounded-b-[50%_7rem] md:pt-36 md:pb-52"
    >
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <RevealHeading
              id="how-title"
              lines={["From the sidewalk", <Serif key="c">to the city</Serif>]}
              className="mt-5 text-section"
            />
          </div>
          <Reveal delay={0.1}>
            <p className="max-w-[55ch] text-lg text-muted lg:justify-self-end">
              The phone sits on a chest mount with the camera facing forward. Everything that keeps you safe runs on the
              phone. The city part only starts when you turn reporting on.
            </p>
          </Reveal>
        </div>

        <ol className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {STEPS.map((step, i) => {
            const Scene = SCENES[i];
            const n = String(i + 1).padStart(2, "0");
            return (
              <Reveal as="li" key={step.title} delay={i * 0.08} className="lg:[&:nth-child(even)]:translate-y-20">
                <NotchCard
                  tab="9rem"
                  label={
                    <>
                      <span className="text-sonar">{n}</span> {step.tab}
                    </>
                  }
                >
                  <div className="aspect-square border-b border-line p-4">
                    {i === 0 ? <DepthStep id="step-0" /> : <Scene id={`step-${i}`} />}
                  </div>
                  <div className="p-5 pb-8">
                    <p className="font-mono text-sm text-muted">
                      Step {i + 1} of {STEPS.length}
                    </p>
                    <h3 className="mt-2 font-display text-2xl leading-none font-extrabold tracking-[-0.02em] uppercase">
                      {step.title}
                    </h3>
                    <p className="mt-4 text-base text-muted">{step.text}</p>
                  </div>
                </NotchCard>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
