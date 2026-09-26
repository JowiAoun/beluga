"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { usePaused } from "@/components/brand/motionState";
import { SceneSlot } from "@/components/three/SceneSlot";
import { cn } from "@/lib/utils";

const BelugaScene = dynamic(() => import("@/components/three/BelugaScene"), { ssr: false });

// The 3D beluga on the setup and start screens only. Walk.tsx swaps this whole screen for the
// walking screen when Start is tapped, which unmounts the canvas and gives its GPU context back
// before depth and the detector need it. The still shows first, and stays with reduced motion,
// no WebGL2, or when the 3D code never reached this phone's cache.
export function WalkBeluga({ className }: { className?: string }) {
  const paused = usePaused();
  return (
    <div className={cn("relative aspect-[5/4]", className)}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(56_189_248/0.22),transparent)] contrast-more:hidden"
      />
      <SceneSlot
        poster={<Image src="/3d/beluga.webp" alt="" fill unoptimized loading="eager" className="object-contain" />}
        className="absolute -inset-[10%]"
      >
        {(controls) => <BelugaScene still={paused} {...controls} />}
      </SceneSlot>
    </div>
  );
}
