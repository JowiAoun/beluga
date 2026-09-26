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
import { TwoSpeeds } from "@/components/landing/TwoSpeeds";

export default function Home() {
  return (
    <MotionPrefs>
      <SkipLink />
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
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
