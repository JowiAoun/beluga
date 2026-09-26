"use client";

import { useInView } from "motion/react";
import { useReducedMotionSafe } from "@/components/brand/MotionPrefs";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

let webgl2: boolean | undefined;

// Asked once per page: some phones and locked-down browsers have no WebGL2.
function hasWebGL2() {
  if (webgl2 === undefined) {
    try {
      webgl2 = Boolean(document.createElement("canvas").getContext("webgl2"));
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

const noSubscribe = () => () => {};

export interface SceneControls {
  onScreen: boolean;
  onReady: () => void;
  onFallback: () => void;
}

// Shows the still image first. The 3D scene mounts once the slot comes near the screen, if the
// browser has WebGL2 and motion is allowed, and the still fades out once the model is drawn.
// The scene stops drawing while it is off screen.
export function SceneSlot({
  poster,
  className,
  children,
}: {
  poster: React.ReactNode;
  className?: string;
  children: (controls: SceneControls) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { margin: "300px 0px" });
  const onScreen = useInView(ref);
  const reduced = useReducedMotionSafe();
  const canDraw = useSyncExternalStore(noSubscribe, hasWebGL2, () => false);
  const [seen, setSeen] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFallback = useCallback(() => setFailed(true), []);

  if (near && !seen) setSeen(true);
  const mount = canDraw && !reduced && !failed && seen;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-water",
          mount && ready ? "opacity-0" : "opacity-100",
        )}
      >
        {poster}
      </div>
      {mount && <div className="absolute inset-0">{children({ onScreen, onReady, onFallback })}</div>}
    </div>
  );
}
