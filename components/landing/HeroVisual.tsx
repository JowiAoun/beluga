"use client";

import { useScroll } from "motion/react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { usePaused } from "@/components/brand/MotionPrefs";
import { SceneSlot } from "@/components/three/SceneSlot";

const BelugaScene = dynamic(() => import("@/components/three/BelugaScene"), { ssr: false });

// The 3D beluga riding its wave. `poster` shows first, and in its place with reduced motion or
// no WebGL2. Scrolling past the hero lets the beluga dip into the wave.
export function HeroVisual({ poster }: { poster: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const paused = usePaused();
  return (
    <div ref={ref} className="relative mx-auto aspect-[5/4] w-full max-w-80 sm:max-w-md lg:max-w-none">
      <div aria-hidden className="absolute inset-[18%] rounded-full bg-sonar/25 blur-3xl contrast-more:hidden" />
      <SceneSlot poster={poster} className="absolute -inset-[10%]">
        {(controls) => <BelugaScene still={paused} progress={scrollYProgress} {...controls} />}
      </SceneSlot>
    </div>
  );
}
