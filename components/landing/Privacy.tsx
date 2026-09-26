import { IconCheck, IconX } from "@tabler/icons-react";
import { CARD } from "@/components/brand/Card";
import { Reveal } from "@/components/brand/Reveal";
import { Section } from "@/components/brand/Section";
import { cn } from "@/lib/utils";

// The same words as the first-run flow on /walk.
const SENT = ["The hazard type", "Its distance", "A rough location, within about 100 metres", "The time"];
const NEVER = ["Images", "Audio", "Your exact location", "Who you are"];

export function Privacy() {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title="What leaves your phone"
      intro="Reporting is off until you turn it on. Even then, only these few facts go to the city's database."
      className="bg-abyss"
    >
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <Reveal className={cn(CARD, "p-6 sm:p-8")}>
          <h3 className="text-xl font-bold sm:text-2xl">Sent, with reporting on</h3>
          <ul className="mt-5 flex flex-col gap-3">
            {SENT.map((item) => (
              <li key={item} className="flex items-center gap-3 text-lg">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sonar/15 text-sonar">
                  <IconCheck aria-hidden size={18} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className={cn(CARD, "border-accent/30 p-6 sm:p-8")}>
          <h3 className="text-xl font-bold sm:text-2xl">Never sent</h3>
          <ul className="mt-5 flex flex-col gap-3">
            {NEVER.map((item) => (
              <li key={item} className="flex items-center gap-3 text-lg">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <IconX aria-hidden size={18} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <Reveal delay={0.15}>
        <p className="mt-6 max-w-[70ch] text-muted">
          Ask is separate: a tap sends one camera frame to an ElevenLabs agent that sees with Gemini. beluga never
          stores the frame, and the conversation is deleted right after the answer.
        </p>
      </Reveal>
    </Section>
  );
}
