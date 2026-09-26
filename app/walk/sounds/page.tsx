import type { Metadata } from "next";
import Sounds from "./Sounds";

export const metadata: Metadata = { title: "beluga sounds" };

// Hidden audition page (Phase 3a): every sound left, centre and right, plus the blindfold test.
export default function SoundsPage() {
  return <Sounds />;
}
