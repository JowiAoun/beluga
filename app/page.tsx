import { Marquee } from "@/components/brand/Marquee";
import { MotionPrefs } from "@/components/brand/MotionPrefs";
import { Navbar } from "@/components/brand/Navbar";
import { SkipLink } from "@/components/brand/Section";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { ForTheCity } from "@/components/landing/ForTheCity";
import { HearWarning } from "@/components/landing/HearWarning";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Privacy } from "@/components/landing/Privacy";
import { Statement } from "@/components/landing/Statement";
import { TwoSpeeds } from "@/components/landing/TwoSpeeds";

// What beluga warns about, sliding past between the hero and the statement.
const WARNINGS = ["Left", "Ahead", "Right", "Step down", "Head height", "Pole, 2 m", "Scooter", "Curb"];

export default function Home() {
  return (
    <MotionPrefs>
      <SkipLink />
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Marquee items={WARNINGS} className="tone-accent py-5 font-display text-section font-extrabold uppercase" />
        <Statement />
        <HearWarning />
        <HowItWorks />
        <TwoSpeeds />
        <Features />
        <Privacy />
        <ForTheCity />
      </main>
      <Footer />
    </MotionPrefs>
  );
}
