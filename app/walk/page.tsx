import type { Metadata } from "next";
import DeviceCheck from "./check/DeviceCheck";

export const metadata: Metadata = { title: "beluga device check" };

// Phase 0: the device check. Phase 1 replaces this with the walking app.
export default function WalkPage() {
  return <DeviceCheck />;
}
