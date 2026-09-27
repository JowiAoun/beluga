import Link from "next/link";
import { IconArrowUpRight, IconBrandGithub, IconWalk } from "@tabler/icons-react";
import { ButtonLink, Roll } from "@/components/brand/Button";
import { LiveContours } from "@/components/brand/LiveContours";
import { DISPLAY, Eyebrow, Name, Serif } from "@/components/brand/Display";
import { Scribble } from "@/components/brand/Scribble";
import { BelugaStage } from "@/components/three/BelugaStage";
import { cn } from "@/lib/utils";

export const SOURCE = "https://github.com/JowiAoun/beluga";

const PAGES = [
  { name: "Walk with beluga", href: "/walk" },
  { name: "How it works", href: "/#how" },
  { name: "Hear it", href: "/#hear" },
  { name: "City dashboard", href: "/map" },
];

const LINK = cn(DISPLAY, "group inline-flex min-h-11 items-center rounded-md text-2xl sm:text-3xl");

// The closing panel: a dark card with a bump on top, sitting in a blue glow at the bottom of the
// page, with the 3D beluga in the middle.
export function Footer() {
  return (
    <footer className="tone-paper relative isolate overflow-hidden pt-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-190%,transparent_68%,var(--accent)_83%)] contrast-more:hidden"
      />
      <div className="px-2 sm:px-4">
        <div className="tone-ink relative mx-auto max-w-[90rem] rounded-[1.5rem] px-4 pt-16 pb-10 sm:px-10">
          <svg
            aria-hidden
            viewBox="0 0 320 40"
            className="absolute bottom-[calc(100%-1px)] left-1/2 h-10 w-80 -translate-x-1/2 text-background"
          >
            <path d="M0 40c40 0 48-40 92-40h136c44 0 52 40 92 40z" fill="currentColor" />
          </svg>
          <div className="absolute inset-0 overflow-hidden rounded-[1.5rem]">
            <LiveContours variant="a" />
          </div>

          <div className="relative text-center">
            <Scribble className="mx-auto -mb-6 w-44 sm:w-60" />
            <h2 className={cn(DISPLAY, "text-section")}>
              Hear <Serif>the way.</Serif>
            </h2>
          </div>

          <div className="relative mt-12 grid items-end gap-12 lg:grid-cols-[1fr_minmax(0,30rem)_1fr]">
            <nav aria-label="Footer" className="flex flex-col items-center gap-1 lg:items-start">
              <Eyebrow className="mb-3">Pages</Eyebrow>
              {PAGES.map((page) => (
                <Link key={page.href} href={page.href} className={LINK}>
                  <Roll>
                    <span>{page.name === "Walk with beluga" ? <>Walk with <Name /></> : page.name}</span>
                  </Roll>
                </Link>
              ))}
              <a href={SOURCE} className={LINK}>
                <Roll className="gap-2">
                  <IconBrandGithub aria-hidden className="size-[0.8em]" />
                  Source
                  <IconArrowUpRight aria-hidden className="size-[0.7em] text-accent" />
                </Roll>
              </a>
            </nav>

            <BelugaStage className="order-first mx-auto w-full max-w-sm lg:order-none lg:max-w-none" />

            <div className="flex flex-col items-center gap-4 text-center lg:items-end lg:text-right">
              <Eyebrow>Built with</Eyebrow>
              <p className="max-w-[40ch] text-muted">
                WebXR and ARCore in Chrome for Android, Web Audio, MediaPipe, ElevenLabs agents and sounds, Gemini, Tiger
                Data (TimescaleDB and PostGIS), Next.js on Vercel, and the beluga.surf domain from GoDaddy Registry.
              </p>
              <p className="max-w-[40ch] text-sm text-muted">
                Type in Mona Sans, Instrument Serif and Atkinson Hyperlegible, which the Braille Institute made for
                low-vision readers.
              </p>
              <ButtonLink href="/walk" size="lg" className="mt-2">
                <IconWalk aria-hidden size={22} />
                Try <Name />
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>

      <div className="tone-accent mt-10 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-2 font-semibold md:flex-row md:items-center md:justify-between">
          <p className="max-w-[70ch]">
            beluga is a research prototype built at Hack the Hill III. It is not a medical device. Use it alongside your
            white cane or guide dog, never in place of them.
          </p>
          <p>Not affiliated with the City of Ottawa or OC Transpo.</p>
        </div>
      </div>
    </footer>
  );
}
