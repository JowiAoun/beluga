import { ButtonLink } from "@/components/brand/Button";
import { Contours } from "@/components/brand/Contours";
import { DISPLAY, Serif } from "@/components/brand/Display";
import { BelugaStage } from "@/components/three/BelugaStage";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main
      id="main"
      className="tone-dark relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16 text-center"
    >
      <Contours variant="b" />
      <BelugaStage className="relative w-72 sm:w-96" sizes="24rem" />
      <p className="relative mt-4 font-display text-hero font-extrabold text-accent tabular-nums">404</p>
      <h1 className={cn(DISPLAY, "relative mt-2 text-section")}>
        Nothing <Serif>echoed back</Serif>
      </h1>
      <p className="relative mt-5 max-w-[45ch] text-lg text-muted">
        This page isn&apos;t here. The link may be old, or the address may have a typo.
      </p>
      <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" size="lg">
          Go to the home page
        </ButtonLink>
        <ButtonLink href="/map" size="lg" variant="secondary">
          City dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
