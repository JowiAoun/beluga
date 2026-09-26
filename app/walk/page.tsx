import type { Metadata } from "next";
import Walk from "./Walk";

export const metadata: Metadata = { title: "beluga" };

export default function WalkPage() {
  return <Walk />;
}
