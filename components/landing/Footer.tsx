import Link from "next/link";
import { IconBrandGithub } from "@tabler/icons-react";
import { Logo } from "@/components/brand/Logo";

export const SOURCE = "https://github.com/AshwinSri23/beluga";

export function Footer() {
  return (
    <footer className="border-t border-line bg-abyss px-4 pt-16 pb-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo className="text-2xl" />
          <p className="max-w-[48ch] text-muted">
            beluga is a research prototype built at Hack the Hill III. It is not a medical device. Use it alongside your
            white cane or guide dog, never in place of them.
          </p>
          <p className="text-muted">Not affiliated with the City of Ottawa or OC Transpo.</p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-1">
          <h2 className="mb-2 font-mono text-sm tracking-[0.18em] text-sonar uppercase">Pages</h2>
          <Link className="flex min-h-11 items-center hover:text-sonar" href="/walk">
            Try beluga (Android Chrome)
          </Link>
          <Link className="flex min-h-11 items-center hover:text-sonar" href="/map">
            City dashboard
          </Link>
          <a className="flex min-h-11 items-center gap-2 hover:text-sonar" href={SOURCE}>
            <IconBrandGithub aria-hidden size={20} />
            Source code
          </a>
        </nav>

        <div className="flex flex-col gap-3 text-muted">
          <h2 className="mb-1 font-mono text-sm tracking-[0.18em] text-sonar uppercase">Built with</h2>
          <p>
            WebXR and ARCore in Chrome for Android, Web Audio, MediaPipe, ElevenLabs agents and sounds, Gemini, Tiger
            Data (TimescaleDB and PostGIS), Next.js on Vercel, and the beluga.surf domain from GoDaddy Registry.
          </p>
          <p className="text-sm">
            Components from Aceternity UI, Magic UI and React Bits. Type in Atkinson Hyperlegible, made by the Braille
            Institute.
          </p>
        </div>
      </div>
    </footer>
  );
}
