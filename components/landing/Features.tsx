import {
  IconAccessible,
  IconEar,
  IconMessageCircleQuestion,
  IconShieldLock,
  IconStairsDown,
  IconWifiOff,
} from "@tabler/icons-react";
import { CARD } from "@/components/brand/Card";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { SonarRings } from "@/components/brand/SonarRings";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";

// Based on Aceternity UI's Bento Grid.
const FEATURES = [
  {
    title: "Bone conduction",
    text: "Sounds go through your cheekbones, so your ears stay open to traffic, voices and your cane.",
    Icon: IconEar,
    className: "md:col-span-2",
    art: "rings",
  },
  {
    title: "Drop-offs and head height",
    text: "A step down, a curb edge or a sign at head height each have their own sound, since a cane can miss them.",
    Icon: IconStairsDown,
  },
  {
    title: "Ask",
    text: "One tap sends one camera frame. The answer is spoken from the object's side.",
    Icon: IconMessageCircleQuestion,
  },
  {
    title: "Works with no signal",
    text: "Warnings come from the phone alone. Once installed, beluga opens and warns you offline, and Ask tells you when it can't reach the network.",
    Icon: IconWifiOff,
    className: "md:col-span-2",
    art: "bars",
  },
  {
    title: "Made for TalkBack",
    text: "Big buttons, spoken prompts, and a Stop button you hold down, so a bump in your pocket can't end a walk.",
    Icon: IconAccessible,
  },
  {
    title: "Private by design",
    text: "No image ever reaches the database. Reports stay off until you turn them on.",
    Icon: IconShieldLock,
    className: "md:col-span-2",
    art: "never",
  },
] as const;

function Art({ kind }: { kind?: "rings" | "bars" | "never" }) {
  if (kind === "rings")
    return (
      <div aria-hidden className="absolute top-1/2 right-10 hidden size-40 -translate-y-1/2 sm:block">
        <SonarRings className="inset-0" count={3} />
        <span className="absolute top-1/2 left-1/2 size-4 -translate-1/2 rounded-full bg-sonar" />
      </div>
    );
  if (kind === "bars")
    return (
      <div aria-hidden className="absolute right-10 bottom-8 hidden items-end gap-1.5 sm:flex">
        {[0.3, 0.55, 0.8, 1].map((h, i) => (
          <span
            key={i}
            className={cn("w-3 rounded-full", i < 3 ? "bg-sonar/25" : "bg-sonar/10")}
            style={{ height: `${h * 64}px` }}
          />
        ))}
        <span className="ml-2 font-mono text-sm text-muted">offline</span>
      </div>
    );
  if (kind === "never")
    return (
      <ul aria-hidden className="absolute top-8 right-8 hidden flex-col items-end gap-2 sm:flex">
        {["No images", "No audio", "No names"].map((t) => (
          <li
            key={t}
            className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1 font-mono text-sm text-accent"
          >
            {t}
          </li>
        ))}
      </ul>
    );
  return null;
}

export function Features() {
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Built for walking with a cane or a guide dog"
      intro="Each part answers one question: what do you need to hear, and what should stay out of your way?"
    >
      <ul className="mt-12 grid gap-4 md:auto-rows-[16rem] md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.title}
            as="li"
            delay={0.05 * i}
            className={cn("relative rounded-3xl", "className" in f && f.className)}
          >
            <div className={cn(CARD, "relative flex h-full flex-col justify-end gap-3 p-6 sm:p-8")}>
              <GlowingEffect />
              <Art kind={"art" in f ? f.art : undefined} />
              <f.Icon aria-hidden size={32} className="text-sonar" />
              <h3 className="text-xl font-bold sm:text-2xl">{f.title}</h3>
              <p className="max-w-[46ch] text-muted">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
