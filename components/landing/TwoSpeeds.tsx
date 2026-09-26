"use client";

import {
  IconAlertTriangle,
  IconCamera,
  IconDatabase,
  IconHeadphones,
  IconMap2,
  IconMessageCircleQuestion,
  IconRadar,
  IconRobot,
  IconVolume,
  IconWaveSine,
} from "@tabler/icons-react";
import { useRef } from "react";
import { CARD } from "@/components/brand/Card";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

const FAST = [
  { name: "Camera", Icon: IconCamera },
  { name: "Depth", Icon: IconRadar },
  { name: "Hazard", Icon: IconAlertTriangle },
  { name: "Sound", Icon: IconWaveSine },
  { name: "Earbuds", Icon: IconHeadphones },
];

const SLOW = [
  {
    title: "Ask, when you want to know more",
    text: "One tap sends one camera frame. beluga never stores it, and the agent's conversation is deleted right after the answer.",
    path: [
      { name: "Ask", Icon: IconMessageCircleQuestion },
      { name: "ElevenLabs agent, sees with Gemini", Icon: IconRobot },
      { name: "Spoken from the object's side", Icon: IconVolume },
    ],
  },
  {
    title: "Reports, when you turn them on",
    text: "The hazard type, its distance, a rough location and the time. The city sees the spots worth fixing first.",
    path: [
      { name: "Report", Icon: IconAlertTriangle },
      { name: "Tiger Data", Icon: IconDatabase },
      { name: "City dashboard", Icon: IconMap2 },
    ],
  },
];

function Node({
  name,
  Icon,
  nodeRef,
  lit,
}: {
  name: string;
  Icon: typeof IconCamera;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  lit?: boolean;
}) {
  return (
    <li className="relative z-10 flex flex-col items-center gap-3">
      <div
        ref={nodeRef}
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl border bg-abyss sm:size-16",
          lit ? "border-accent text-accent" : "border-sonar/50 text-sonar",
        )}
      >
        <Icon aria-hidden className="size-6 sm:size-8" />
      </div>
      <span className="text-sm font-semibold sm:text-base">{name}</span>
    </li>
  );
}

export function TwoSpeeds() {
  const container = useRef<HTMLDivElement>(null);
  // One ref per node in FAST, for the beams to find.
  const refs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <Section
      id="speeds"
      eyebrow="Two speeds"
      title={["Fast where it keeps you safe"]}
      intro="Warnings never wait for the network. The slower parts, Ask and reports, only run when you ask for them."
    >
      <Reveal delay={0.1} className={cn(CARD, "mt-12 overflow-hidden p-5 sm:p-10")}>
        <p className="mx-auto w-fit rounded-full border border-sonar/40 bg-sonar/10 px-4 py-1.5 text-center font-mono text-sm text-sonar">
          On the phone, no network, 10 times a second
        </p>
        <div ref={container} className="relative mt-10">
          <ol className="relative flex items-start justify-between">
            {FAST.map((node, i) => (
              <Node key={node.name} {...node} lit={i === FAST.length - 1} nodeRef={refs[i]} />
            ))}
          </ol>
          {FAST.slice(1).map((node, i) => (
            <AnimatedBeam
              key={node.name}
              containerRef={container}
              fromRef={refs[i]}
              toRef={refs[i + 1]}
              duration={2.4}
              delay={i * 0.3}
              pathColor="#38bdf8"
              pathOpacity={0.25}
              gradientStartColor="#38bdf8"
              gradientStopColor="#fde047"
            />
          ))}
        </div>
      </Reveal>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {SLOW.map((slow, i) => (
          <Reveal key={slow.title} delay={0.15 + i * 0.1} className={cn(CARD, "p-6 sm:p-8")}>
            <h3 className="text-xl font-bold sm:text-2xl">{slow.title}</h3>
            <p className="mt-2 text-muted">{slow.text}</p>
            <ol className="mt-6 flex flex-col gap-3">
              {slow.path.map((step, j) => (
                <li key={step.name} className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-abyss text-sonar">
                    <step.Icon aria-hidden size={22} />
                  </span>
                  <span className="font-semibold">{step.name}</span>
                  {j < slow.path.length - 1 && <span className="sr-only">, then</span>}
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
