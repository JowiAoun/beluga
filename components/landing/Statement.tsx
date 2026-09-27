import { LiveContours } from "@/components/brand/LiveContours";
import { DISPLAY, Eyebrow, Serif } from "@/components/brand/Display";
import { BelugaMark } from "@/components/brand/Logo";
import { Reveal } from "@/components/brand/Reveal";
import { Scribble } from "@/components/brand/Scribble";
import { cn } from "@/lib/utils";

// The whole idea in one big sentence, before the details.
export function Statement() {
  return (
    <div className="tone-paper relative isolate overflow-hidden px-4 py-28 sm:px-6 md:py-40">
      <LiveContours variant="a" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center text-center">
        <Reveal>
          <Eyebrow icon={<BelugaMark size={32} className="size-8" />}>Made for walking with a cane or guide dog</Eyebrow>
        </Reveal>
        <Reveal delay={0.1}>
          <p className={cn(DISPLAY, "mt-8 text-statement")}>
            A pole on your <Serif>left</Serif> sounds on your <Serif>left</Serif>. A <Serif>step down</Serif> ahead
            sounds <Serif>ahead</Serif>. Your hands stay on the <Serif>cane</Serif>.
          </p>
        </Reveal>
        <Scribble className="mt-12 w-64 sm:w-96" />
      </div>
    </div>
  );
}
