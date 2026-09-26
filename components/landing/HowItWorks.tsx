"use client";

// Based on Aceternity UI's Sticky Scroll Reveal, driven by the page's own scroll: the picture
// stays beside the steps on wide screens and changes with the step in the middle of the screen.
// On phones each step shows its own picture above its text.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CARD } from "@/components/brand/Card";
import { usePaused } from "@/components/brand/MotionPrefs";
import { Reveal, RevealHeading } from "@/components/brand/Reveal";
import { SceneSlot } from "@/components/three/SceneSlot";
import { cn } from "@/lib/utils";
import { DepthScene, SCENES } from "./StepScenes";

const PhoneScene = dynamic(() => import("@/components/three/PhoneScene"), { ssr: false });

// Step 1 in 3D: the phone and the corridor from its camera. The drawing shows first, and stays
// with reduced motion or no WebGL2. The scene only draws while its step is showing.
function DepthStep({ id, active }: { id: string; active: boolean }) {
  const paused = usePaused();
  return (
    <SceneSlot poster={<DepthScene id={id} />} className="size-full">
      {(controls) => <PhoneScene still={paused} active={active} {...controls} />}
    </SceneSlot>
  );
}

const STEPS = [
  {
    title: "Depth on the phone",
    text: "Chrome's WebXR and ARCore depth measure everything in a narrow walking corridor, ten times a second. This part never touches the network.",
  },
  {
    title: "Sounds from the obstacle's side",
    text: "A short sound plays from the side of what is in the way and repeats faster as it gets closer, made for bone-conduction earbuds that keep the ears open to traffic. Drop-offs and head-height hazards have their own sounds.",
  },
  {
    title: "Ask, and civic triage",
    text: "A tap on Ask sends one camera frame to an ElevenLabs agent that sees with Gemini, and the answer is spoken from the object's side. The same kind of agent answers questions about lasting hazards, and fixed rules decide what gets reported.",
  },
  {
    title: "A fix-first list for the city",
    text: "With consent, anonymous reports rounded to about 100 m land in Tiger Data. Continuous aggregates rank the spots worth fixing first around Ottawa's O-Train stations.",
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    // A step counts as active while it crosses the middle of the screen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(steps.current.indexOf(entry.target as HTMLLIElement));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how" aria-labelledby="how-title" className="relative bg-abyss px-4 py-24 sm:px-6 md:py-32">
      <div aria-hidden className="absolute inset-0 bg-dots mask-fade opacity-50" />
      <div className="relative mx-auto max-w-6xl">
        <p className="font-mono text-sm font-medium tracking-[0.18em] text-sonar uppercase">How it works</p>
        <RevealHeading id="how-title" text="From the sidewalk to the city" className="mt-3 max-w-3xl text-section" />
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-[65ch] text-lg text-muted">
            The phone sits on a chest mount with the camera facing forward. Everything that keeps you safe runs on the
            phone. The city part only starts when you turn reporting on.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ol className="flex flex-col gap-16 lg:gap-0">
            {STEPS.map((step, i) => {
              const Scene = SCENES[i];
              return (
                <li
                  key={step.title}
                  ref={(el) => void (steps.current[i] = el)}
                  className="flex flex-col gap-6 lg:min-h-[70vh] lg:justify-center"
                >
                  <div className={cn(CARD, "aspect-square w-full max-w-sm p-4 lg:hidden")}>
                    {i === 0 ? <DepthStep id="step-0-inline" active /> : <Scene id={`step-${i}-inline`} />}
                  </div>
                  <div
                    className={cn(
                      "border-l-2 pl-6 transition-colors duration-500",
                      active === i ? "border-sonar" : "border-line",
                    )}
                  >
                    <p
                      className={cn(
                        "font-mono text-sm font-medium transition-colors duration-500",
                        active === i ? "text-sonar" : "text-muted",
                      )}
                    >
                      Step {i + 1} of {STEPS.length}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold sm:text-3xl">{step.title}</h3>
                    <p className="mt-3 max-w-[55ch] text-lg text-muted">{step.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="hidden lg:block">
            <div
              className={cn(CARD, "sticky top-[calc(50vh-15rem)] aspect-square w-full max-w-[30rem] overflow-hidden")}
            >
              <div aria-hidden className="absolute inset-[15%] rounded-full bg-sonar/10 blur-3xl" />
              {SCENES.map((Scene, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute inset-0 p-6 transition-[opacity,transform] duration-700 ease-water",
                    active === i ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
                  )}
                >
                  {i === 0 ? <DepthStep id="step-0-sticky" active={active === 0} /> : <Scene id={`step-${i}-sticky`} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
