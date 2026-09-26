"use client";

// The first-run steps from Phase 9, spoken and on screen. Each step moves focus to its heading,
// so TalkBack reads it; the phone's voice says the same short prompt for anyone without TalkBack.

import { useEffect, useRef, useState } from "react";
import { heightText, stepHeight } from "./settings";
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

const BIG = "min-h-20 rounded-lg px-4 text-xl font-bold";

export interface FirstRunResult {
  reporting: boolean;
  heightM: number;
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

  if (step === null) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Set up beluga</h2>
        <p className="text-lg">Five short steps, spoken aloud. They take about a minute.</p>
        <button
          type="button"
          onClick={() => {
            // Chrome only lets a page speak after a tap.
            unlockVoice();
            go("welcome");
          }}
          className={`${BIG} bg-yellow-300 text-black`}
        >
          Start setup
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
        {PROMPTS[step]}
      </h2>

      {step === "welcome" && (
        <button type="button" onClick={() => go("reporting")} className={`${BIG} bg-yellow-300 text-black`}>
          Continue
        </button>
      )}

      {step === "reporting" && (
        <>
          <p className="text-lg">
            Sent: the hazard type, its distance, a rough location within about 100 metres, and the time. Never sent:
            images, audio, your exact location or who you are.
          </p>
          <button
            type="button"
            onClick={() => {
              setReporting(true);
              go("location");
            }}
            className={`${BIG} bg-yellow-300 text-black`}
          >
            Help the city: share anonymous hazard reports
          </button>
          <button
            type="button"
            onClick={() => {
              setReporting(false);
              go("location");
            }}
            className={`${BIG} border-2 border-neutral-400`}
          >
            Not now
          </button>
        </>
      )}

      {step === "location" && (
        <>
          {locationGranted ? (
            <p className="text-lg">Location is already on.</p>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await onAllowLocation();
                go("height");
              }}
              className={`${BIG} bg-yellow-300 text-black`}
            >
              Allow location
            </button>
          )}
          <button type="button" onClick={() => go("height")} className={`${BIG} border-2 border-neutral-400`}>
            {locationGranted ? "Continue" : "Skip"}
          </button>
        </>
      )}

      {step === "height" && (
        <>
          <p aria-live="polite" className="text-center text-5xl font-bold tabular-nums">
            {heightText(heightM)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHeightM((h) => stepHeight(h, -1))}
              className={`${BIG} border-2 border-neutral-400`}
            >
              Shorter by 5 cm
            </button>
            <button
              type="button"
              onClick={() => setHeightM((h) => stepHeight(h, 1))}
              className={`${BIG} border-2 border-neutral-400`}
            >
              Taller by 5 cm
            </button>
          </div>
          <button type="button" onClick={() => go("ready")} className={`${BIG} bg-yellow-300 text-black`}>
            That&apos;s my height
          </button>
        </>
      )}

      {step === "ready" && (
        <button
          type="button"
          onClick={() => onDone({ reporting, heightM })}
          className={`${BIG} bg-yellow-300 text-black`}
        >
          Done
        </button>
      )}
    </section>
  );
}
