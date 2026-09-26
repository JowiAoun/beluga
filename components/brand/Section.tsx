import { cn } from "@/lib/utils";
import { Reveal, RevealHeading } from "./Reveal";

// A landing page section: a small label, a heading that comes in word by word, and an intro.
export function Section({
  id,
  eyebrow,
  title,
  intro,
  className,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("relative px-4 py-24 sm:px-6 md:py-32", className)}>
      <div className="relative mx-auto max-w-6xl">
        {eyebrow && <p className="font-mono text-sm font-medium tracking-[0.18em] text-sonar uppercase">{eyebrow}</p>}
        <RevealHeading id={`${id}-title`} text={title} className="mt-3 max-w-3xl text-section" />
        {intro && (
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-[65ch] text-lg text-muted">{intro}</p>
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

export function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-xl bg-accent px-4 py-3 font-bold text-background transition-transform focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
