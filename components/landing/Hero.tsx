import { IconInfoCircle } from "@tabler/icons-react";
import { ButtonLink } from "@/components/brand/Button";
import { BelugaMark } from "@/components/brand/Logo";
import { Reveal } from "@/components/brand/Reveal";
import { SonarRings } from "@/components/brand/SonarRings";
import { Water } from "@/components/brand/Water";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { Spotlight } from "@/components/ui/spotlight-new";

const FACTS = [
  { value: "10×", label: "depth checks a second" },
  { value: "3 m", label: "walking corridor ahead" },
  { value: "0", label: "network calls to warn you" },
];

// The beluga floats at the surface, with sonar rings from its forehead (the melon, where real
// belugas echolocate from). The 3D beluga takes this place once `public/3d/beluga.glb` exists.
function HeroBeluga() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-72 sm:max-w-md lg:max-w-none">
      <div className="absolute inset-[18%] rounded-full bg-sonar/25 blur-3xl contrast-more:hidden" />
      <div className="absolute inset-x-[10%] top-[22%] motion-safe:animate-float">
        <div className="relative">
          <SonarRings
            className="top-[31%] left-[11%] aspect-square w-[90%] -translate-x-1/2 -translate-y-1/2"
            count={4}
          />
          <BelugaMark className="relative w-full drop-shadow-[0_24px_48px_rgb(56_189_248/0.3)]" />
        </div>
      </div>
      <Water className="absolute inset-x-[-20%] bottom-0 h-[46%] [mask-image:radial-gradient(ellipse_50%_60%_at_50%_40%,black_55%,transparent)]" />
    </div>
  );
}

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
          <HeroBeluga />
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
