import { MotionPrefs } from "@/components/brand/MotionPrefs";
import { Navbar } from "@/components/brand/Navbar";
import { SkipLink } from "@/components/brand/Section";
import { Footer } from "@/components/landing/Footer";
import { HearWarning } from "@/components/landing/HearWarning";
import { Hero } from "@/components/landing/Hero";

export default function Home() {
  return (
    <MotionPrefs>
      <SkipLink />
      <Navbar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <HearWarning />
      </main>
      <Footer />
    </MotionPrefs>
  );
}
