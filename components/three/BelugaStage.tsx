"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { usePaused } from "@/components/brand/motionState";
import { cn } from "@/lib/utils";
import { SceneSlot } from "./SceneSlot";

const BelugaScene = dynamic(() => import("./BelugaScene"), { ssr: false });

// The 3D beluga on its wave, for places other than the hero: the footer and the 404 page. Its
// still shows first, and stays with reduced motion, no WebGL2 or no 3D code offline.
export function BelugaStage({ className, sizes = "28rem" }: { className?: string; sizes?: string }) {
  const paused = usePaused();
  return (
    <div className={cn("relative aspect-[5/4]", className)}>
      <SceneSlot
        poster={<Image src="/3d/beluga.webp" alt="" fill sizes={sizes} className="object-contain" />}
        className="absolute -inset-[10%]"
      >
        {(controls) => <BelugaScene still={paused} {...controls} />}
      </SceneSlot>
    </div>
  );
}
