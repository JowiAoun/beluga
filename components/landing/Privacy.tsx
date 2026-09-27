import { IconCheck, IconX } from "@tabler/icons-react";
import { DISPLAY, Serif } from "@/components/brand/Display";
import { Reveal } from "@/components/brand/Reveal";
import { Scribble } from "@/components/brand/Scribble";
import { Section } from "@/components/brand/Section";
import { cn } from "@/lib/utils";

// The same words as the first-run flow on /walk.
const SENT = ["The hazard type", "Its distance", "A rough location, within about 100 metres", "The time"];
const NEVER = ["Images", "Audio", "Your exact location", "Who you are"];

const WORD = cn(DISPLAY, "text-[clamp(3rem,8vw,7.5rem)] leading-[0.85] tracking-[-0.04em]");

export function Privacy() {
  return (
    <Section
      id="privacy"
      eyebrow="Privacy"
      title={["What leaves", <Serif key="p">your phone</Serif>]}
      intro="Reporting is off until you turn it on. Even then, only these few facts go to the city's database."
      tone="dark"
      contours="b"
      className="overflow-hidden"
    >
      <Scribble className="absolute -top-10 right-0 -z-10 hidden w-[36rem] opacity-40 lg:block" />
      <div className="mt-16 grid border-t border-line md:grid-cols-2">
        <Reveal className="border-b border-line py-10 md:border-r md:border-b-0 md:pr-10">
          <h3 className={WORD}>Sent</h3>
          <p className="mt-3 font-display text-sm font-bold tracking-[0.08em] text-sonar uppercase">With reporting on</p>
          <ul className="mt-8 flex flex-col gap-4">
            {SENT.map((item) => (
              <li key={item} className="flex items-center gap-4 text-lg">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong text-sonar">
                  <IconCheck aria-hidden size={20} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1} className="py-10 md:pl-10">
          <h3 className={WORD}>
            Never <Serif>sent</Serif>
          </h3>
          <p className="mt-3 font-display text-sm font-bold tracking-[0.08em] text-sonar uppercase">Not ever</p>
          <ul className="mt-8 flex flex-col gap-4">
            {NEVER.map((item) => (
              <li key={item} className="flex items-center gap-4 text-lg">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-on-accent">
                  <IconX aria-hidden size={20} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
      <Reveal delay={0.15}>
        <p className="mt-6 max-w-[70ch] border-t border-line pt-6 text-lg text-muted">
          Ask is separate: a tap sends one camera frame to an ElevenLabs agent that sees with Gemini. beluga never
          stores the frame, and the conversation is deleted right after the answer.
        </p>
      </Reveal>
    </Section>
  );
}
