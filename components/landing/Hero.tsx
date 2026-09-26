import { IconInfoCircle } from "@tabler/icons-react";
import Image from "next/image";
import { ButtonLink } from "@/components/brand/Button";
import { Reveal } from "@/components/brand/Reveal";
import { Water } from "@/components/brand/Water";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { Spotlight } from "@/components/ui/spotlight-new";
import { HeroVisual } from "./HeroVisual";

const FACTS = [
  { value: "10×", label: "depth checks a second" },
  { value: "3 m", label: "walking corridor ahead" },
  { value: "0", label: "network calls to warn you" },
];

// A still of the 3D beluga. It shows first, and in place of the 3D one with reduced motion or
// no WebGL2.
const BELUGA_STILL = (
  <Image
    src="/3d/beluga.webp"
    alt=""
    fill
    loading="eager"
    fetchPriority="high"
    sizes="(min-width: 1024px) 50vw, 90vw"
    className="object-contain"
  />
);

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-abyss px-4 pt-20 pb-16 sm:px-6 md:pt-36 md:pb-24"
    >
      <div className="absolute inset-0 -z-10 bg-dots mask-fade opacity-70" aria-hidden />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-linear-to-b from-transparent to-background"
      />
      <Spotlight />
      <Water className="absolute inset-x-0 bottom-0 -z-10 h-48 opacity-60 sm:h-64" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
        <div className="relative z-10 order-2 lg:order-1">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-muted">
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full rounded-full bg-sonar opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-sonar" />
              </span>
              For blind and low-vision pedestrians
            </p>
          </Reveal>

          <h1 id="hero-title" className="mt-6 text-hero text-balance">
            <EncryptedText text="Hear what's in your way." />
          </h1>

          <Reveal delay={0.2}>
            <p className="mt-6 max-w-[58ch] text-lg text-muted sm:text-xl">
              beluga warns you about obstacles with short sounds that come from the obstacle&apos;s side. It also turns
              lasting hazards, like a scooter left across the sidewalk, into a fix-first list for the city.
            </p>
          </Reveal>

          <Reveal delay={0.3} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/walk" size="lg">
              Try beluga <span className="font-medium opacity-80">(Android Chrome)</span>
            </ButtonLink>
            <ButtonLink href="/map" size="lg" variant="secondary">
              City dashboard
            </ButtonLink>
          </Reveal>

          <Reveal delay={0.4}>
            <p className="mt-6 flex max-w-[60ch] gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-base text-foreground/90">
              <IconInfoCircle aria-hidden className="mt-0.5 shrink-0 text-accent" size={22} />
              <span>
                beluga is a research prototype built at Hack the Hill III. It is not a medical device. Use it alongside
                your white cane or guide dog, never in place of them.
              </span>
            </p>
          </Reveal>
        </div>

        <div className="relative order-1 lg:order-2">
          <HeroVisual poster={BELUGA_STILL} />
        </div>
      </div>

      <Reveal delay={0.5} className="mx-auto mt-14 max-w-6xl">
        <dl className="grid grid-cols-3 divide-x divide-line rounded-3xl border border-line bg-surface md:backdrop-blur-md">
          {FACTS.map((fact) => (
            <div key={fact.label} className="flex flex-col-reverse gap-1 px-3 py-5 text-center sm:px-6">
              <dt className="text-sm text-muted sm:text-base">{fact.label}</dt>
              <dd className="font-mono text-2xl font-medium text-foreground tabular-nums sm:text-4xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}
