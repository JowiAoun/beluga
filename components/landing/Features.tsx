import {
  IconAccessible,
  IconEar,
  IconMessageCircleQuestion,
  IconShieldLock,
  IconStairsDown,
  IconWifiOff,
} from "@tabler/icons-react";
import { Serif } from "@/components/brand/Display";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { SonarRings } from "@/components/brand/SonarRings";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "Bone conduction",
    text: "Sounds go through your cheekbones, so your ears stay open to traffic, voices and your cane.",
    Icon: IconEar,
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
    art: "never",
  },
] as const;

// A small picture under three of the features. Decoration only: the text says the same.
function Art({ kind }: { kind?: "rings" | "bars" | "never" }) {
  if (kind === "rings")
    return (
      <div aria-hidden className="relative mt-8 size-24">
        <SonarRings className="inset-0" count={3} />
        <span className="absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full bg-sonar" />
      </div>
    );
  if (kind === "bars")
    return (
      <div aria-hidden className="mt-8 flex items-end gap-1.5">
        {[0.3, 0.55, 0.8, 1].map((h, i) => (
          <span key={i} className={cn("w-3", i < 3 ? "bg-sonar" : "bg-line")} style={{ height: `${h * 56}px` }} />
        ))}
        <span className="ml-2 font-mono text-sm text-muted">offline</span>
      </div>
    );
  if (kind === "never")
    return (
      <ul aria-hidden className="mt-8 flex flex-wrap gap-2">
        {["No images", "No audio", "No names"].map((t) => (
          <li key={t} className="rounded-md border border-sonar px-3 py-1 font-mono text-sm text-sonar">
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
      title={["Built for the", <Serif key="c">cane &amp; the guide dog</Serif>]}
      tone="paper"
    >
      <ul className="mt-16 grid border-t border-l border-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal
            as="li"
            key={f.title}
            delay={0.05 * i}
            className="flex flex-col border-r border-b border-line p-6 sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="font-display text-5xl leading-none font-extrabold tracking-[-0.04em] text-sonar tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <f.Icon aria-hidden size={32} className="text-sonar" />
            </div>
            <h3 className="mt-8 font-display text-2xl leading-none font-extrabold tracking-[-0.02em] uppercase sm:text-3xl">
              {f.title}
            </h3>
            <p className="mt-4 max-w-[48ch] text-lg text-muted">{f.text}</p>
            {"art" in f && <Art kind={f.art} />}
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
