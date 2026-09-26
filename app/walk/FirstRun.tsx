"use client";

// The first-run steps from Phase 9, spoken and on screen. Each step moves focus to its heading,
// so TalkBack reads it; the phone's voice says the same short prompt for anyone without TalkBack.

import {
  IconBlind,
  IconBuildingCommunity,
  IconCheck,
  IconCircleCheck,
  IconDeviceMobile,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconRuler,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { heightText, stepHeight } from "./settings";
import { PANEL, PRIMARY, SECONDARY } from "./styles";
import { speakText, unlockVoice } from "./voice";

type Step = "welcome" | "reporting" | "location" | "height" | "ready";

const PROMPTS: Record<Step, string> = {
  welcome: "beluga works alongside your cane or guide dog. It can miss things.",
  reporting: "Help the city by sharing anonymous hazard reports? You can change this any time in settings.",
  location:
    "Location marks where hazard reports happen, to about 100 metres. Chrome can't ask during a walk, so it asks now.",
  height: "How tall are you? beluga uses it to watch for things at head height.",
  ready: "Put the phone on your chest mount, camera facing forward, then tap Start.",
};

const ORDER: Step[] = ["welcome", "reporting", "location", "height", "ready"];

const ICONS: Record<Step, typeof IconBlind> = {
  welcome: IconBlind,
  reporting: IconBuildingCommunity,
  location: IconMapPin,
  height: IconRuler,
  ready: IconDeviceMobile,
};

const BIG_PRIMARY = cn(PRIMARY, "min-h-20");
const BIG_SECONDARY = cn(SECONDARY, "min-h-20");

export interface FirstRunResult {
  reporting: boolean;
  heightM: number;
}

// Dots for the eye, and the same thing in words.
function StepDots({ step }: { step: Step }) {
  const at = ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden className="flex items-center gap-1.5">
        {ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-2.5 rounded-full transition-[width,background-color] duration-300 ease-water motion-reduce:transition-none",
              i === at ? "w-8 bg-accent" : "w-2.5",
              i < at && "bg-sonar",
              i > at && "bg-white/20",
            )}
          />
        ))}
      </span>
      <p className="font-mono text-lg text-muted tabular-nums">
        Step {at + 1} of {ORDER.length}
      </p>
    </div>
  );
}

export default function FirstRun({
  heightM: startHeight,
  locationGranted,
  onAllowLocation,
  onDone,
}: {
  heightM: number;
  locationGranted: boolean;
  onAllowLocation: () => Promise<void>;
  onDone: (result: FirstRunResult) => void;
}) {
  const [step, setStep] = useState<Step | null>(null);
  const [reporting, setReporting] = useState(false);
  const [heightM, setHeightM] = useState(startHeight);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step) headingRef.current?.focus();
  }, [step]);

  const go = (next: Step) => {
    setStep(next);
    speakText(PROMPTS[next]);
  };

  const StepIcon = step ? ICONS[step] : null;

  if (step === null) {
    return (
      <section className={cn(PANEL, "flex flex-col gap-5")}>
        <h2 className="text-3xl font-bold">Set up beluga</h2>
        <p className="text-xl text-muted">Five short steps, spoken aloud. They take about a minute.</p>
        <button
          type="button"
          onClick={() => {
            // Chrome only lets a page speak after a tap.
            unlockVoice();
            go("welcome");
          }}
          className={BIG_PRIMARY}
        >
          Start setup
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <StepDots step={step} />

      {/* A new key per step, so each one slides in from the right. */}
      <div
        key={step}
        className="flex flex-col gap-4 transition-[opacity,translate] duration-300 ease-water starting:translate-x-10 starting:opacity-0 motion-reduce:transition-none"
      >
        {StepIcon && (
          <span
            aria-hidden
            className="grid size-16 place-items-center rounded-2xl border border-sonar/30 bg-sonar/10 text-sonar"
          >
            <StepIcon size={34} stroke={1.75} />
          </span>
        )}
        <h2 ref={headingRef} tabIndex={-1} className="mb-2 text-3xl leading-tight font-bold text-balance outline-none">
          {PROMPTS[step]}
        </h2>

        {step === "welcome" && (
          <button type="button" onClick={() => go("reporting")} className={BIG_PRIMARY}>
            Continue
          </button>
        )}

        {step === "reporting" && (
          <>
            <div className={cn(PANEL, "flex flex-col gap-4 text-xl")}>
              <p className="flex gap-3">
                <IconCheck aria-hidden size={24} className="mt-0.5 shrink-0 text-sonar" />
                <span>
                  <strong>Sent:</strong> the hazard type, its distance, a rough location within about 100 metres, and
                  the time.
                </span>
              </p>
              <p className="flex gap-3">
                <IconX aria-hidden size={24} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  <strong>Never sent:</strong> images, audio, your exact location or who you are.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setReporting(true);
                go("location");
              }}
              className={cn(BIG_PRIMARY, "py-3 text-balance")}
            >
              Help the city: share anonymous hazard reports
            </button>
            <button
              type="button"
              onClick={() => {
                setReporting(false);
                go("location");
              }}
              className={BIG_SECONDARY}
            >
              Not now
            </button>
          </>
        )}

        {step === "location" && (
          <>
            {locationGranted ? (
              <p className={cn(PANEL, "flex items-center gap-3 text-xl")}>
                <IconCircleCheck aria-hidden size={24} className="shrink-0 text-sonar" />
                Location is already on.
              </p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await onAllowLocation();
                  go("height");
                }}
                className={BIG_PRIMARY}
              >
                Allow location
              </button>
            )}
            <button
              type="button"
              onClick={() => go("height")}
              className={locationGranted ? BIG_PRIMARY : BIG_SECONDARY}
            >
              {locationGranted ? "Continue" : "Skip"}
            </button>
          </>
        )}

        {step === "height" && (
          <>
            <div className={cn(PANEL, "py-8 text-center")}>
              <p aria-live="polite">
                <span className="sr-only">{heightText(heightM)}</span>
                <span aria-hidden className="block font-mono text-7xl font-medium tabular-nums">
                  {heightM.toFixed(2)}
                </span>
                <span aria-hidden className="mt-2 block text-xl text-muted">
                  metres
                </span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHeightM((h) => stepHeight(h, -1))}
                className={cn(BIG_SECONDARY, "flex-col gap-1 px-2 py-3 text-lg text-balance")}
              >
                <IconMinus aria-hidden size={24} />
                Shorter by 5 cm
              </button>
              <button
                type="button"
                onClick={() => setHeightM((h) => stepHeight(h, 1))}
                className={cn(BIG_SECONDARY, "flex-col gap-1 px-2 py-3 text-lg text-balance")}
              >
                <IconPlus aria-hidden size={24} />
                Taller by 5 cm
              </button>
            </div>
            <button type="button" onClick={() => go("ready")} className={BIG_PRIMARY}>
              That&apos;s my height
            </button>
          </>
        )}

        {step === "ready" && (
          <button type="button" onClick={() => onDone({ reporting, heightM })} className={BIG_PRIMARY}>
            Done
          </button>
        )}
      </div>
    </section>
  );
}
