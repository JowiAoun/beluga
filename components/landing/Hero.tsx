import { IconArrowDown, IconHeadphones, IconInfoCircle, IconWalk } from "@tabler/icons-react";
import Image from "next/image";
import { ButtonLink } from "@/components/brand/Button";
import { LiveContours } from "@/components/brand/LiveContours";
import { Eyebrow, Name, Serif } from "@/components/brand/Display";
import { Reveal, RevealHeading } from "@/components/brand/Reveal";
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
      className="tone-dark relative isolate overflow-hidden px-4 pt-24 sm:px-6 md:pt-28 lg:flex lg:min-h-dvh lg:flex-col"
    >
      <LiveContours variant="b" />

      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-4">
        <div className="relative z-10 order-2 lg:order-1">
          <Reveal>
            <Eyebrow>For blind &amp; low-vision pedestrians</Eyebrow>
          </Reveal>

          <RevealHeading
            as="h1"
            id="hero-title"
            lines={["Hear what's", <Serif key="way">in your way.</Serif>]}
            className="mt-5 text-hero text-pretty"
          />

          <Reveal delay={0.25}>
            <p className="mt-7 max-w-[54ch] text-lg text-muted sm:text-xl">
              beluga warns you about obstacles with short sounds that come from the obstacle&apos;s side. It also turns
              lasting hazards, like a scooter left across the sidewalk, into a fix-first list for the city.
            </p>
          </Reveal>

          <Reveal delay={0.35} className="mt-8 flex flex-col gap-3 sm:flex-row [&>a]:whitespace-nowrap">
            <ButtonLink href="/walk" size="lg">
              <IconWalk aria-hidden size={22} />
              Try <Name />
              <span className="font-sans font-semibold normal-case">(Android Chrome)</span>
            </ButtonLink>
            <ButtonLink href="/map" size="lg" variant="secondary">
              City dashboard
            </ButtonLink>
          </Reveal>

          <Reveal delay={0.45}>
            <p className="mt-6 flex max-w-[60ch] gap-3 border border-line-strong p-4 text-base">
              <IconInfoCircle aria-hidden className="mt-0.5 shrink-0 text-sonar" size={22} />
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

      <Reveal delay={0.5} className="relative mx-auto mt-12 w-full max-w-7xl">
        <div className="grid border-t border-line lg:grid-cols-4">
          <dl className="grid grid-cols-3 lg:col-span-3">
            {FACTS.map((fact) => (
              <div
                key={fact.label}
                className="flex flex-col-reverse gap-1 border-r border-line py-6 pr-3 [&:not(:first-child)]:pl-3 sm:pr-6 sm:[&:not(:first-child)]:pl-6"
              >
                <dt className="text-sm text-muted sm:text-base">{fact.label}</dt>
                <dd className="font-display text-3xl font-extrabold tracking-[-0.03em] tabular-nums sm:text-5xl">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          <a
            href="#hear"
            className="group flex items-center justify-between gap-4 border-t border-line py-6 lg:border-t-0 lg:pl-6"
          >
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-display text-sm font-bold tracking-[0.08em] text-sonar uppercase">
                <IconHeadphones aria-hidden size={18} />
                Headphones on
              </span>
              <span className="font-display text-2xl font-extrabold uppercase">Hear a warning</span>
            </span>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent transition-transform duration-600 ease-out-expo motion-safe:group-hover:translate-y-1">
              <IconArrowDown aria-hidden size={24} />
            </span>
          </a>
        </div>
      </Reveal>
    </section>
  );
}
