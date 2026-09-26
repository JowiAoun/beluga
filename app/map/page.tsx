import type { Metadata } from "next";
import { MotionPrefs } from "@/components/brand/MotionPrefs";
import { Navbar } from "@/components/brand/Navbar";
import { SkipLink } from "@/components/brand/Section";
import { Footer } from "@/components/landing/Footer";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "beluga for cities" };

export default function MapPage() {
  return (
    <MotionPrefs>
      <SkipLink />
      <Navbar />
      <Dashboard />
      <Footer />
    </MotionPrefs>
  );
}
