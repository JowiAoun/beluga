import type { Metadata } from "next";
import DeviceCheck from "./DeviceCheck";

export const metadata: Metadata = { title: "beluga device check" };

// Stays at /walk/check after /walk becomes the real app, for testing other phones.
export default function DeviceCheckPage() {
  return <DeviceCheck />;
}
