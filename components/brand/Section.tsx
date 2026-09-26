import { cn } from "@/lib/utils";
import { Contours } from "./Contours";
import { Eyebrow } from "./Display";
import { Reveal, RevealHeading } from "./Reveal";

export type Tone = "dark" | "ink" | "paper";

export const TONES: Record<Tone, string> = { dark: "tone-dark", ink: "tone-ink", paper: "tone-paper" };

// A landing page section: a small label, a heading whose lines slide in, and an intro. `title` is
// one entry per line, so a line can mix in the serif.
export function Section({
  id,
  eyebrow,
  title,
  intro,
  tone = "dark",
  contours,
  className,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode[];
  intro?: React.ReactNode;
  tone?: Tone;
  contours?: "a" | "b";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("relative isolate px-4 py-24 sm:px-6 md:py-36", TONES[tone], className)}
    >
      {contours && <Contours variant={contours} />}
      <div className="relative mx-auto max-w-7xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <RevealHeading id={`${id}-title`} lines={title} className="mt-5 max-w-5xl text-section" />
        {intro && (
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-[60ch] text-lg text-muted">{intro}</p>
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
      className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-accent px-4 py-3 font-display font-extrabold text-on-accent uppercase transition-transform focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}
