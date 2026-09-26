import Image from "next/image";
import { ButtonLink } from "@/components/brand/Button";
import { SonarRings } from "@/components/brand/SonarRings";

export default function NotFound() {
  return (
    <main
      id="main"
      className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-abyss px-4 py-16 text-center"
    >
      <div aria-hidden className="absolute inset-0 -z-10 bg-dots mask-fade opacity-70" />
      <div className="relative mb-6 aspect-[5/4] w-72 sm:w-96">
        <SonarRings
          className="top-[30%] left-[70%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2"
          count={3}
        />
        <Image src="/3d/beluga.webp" alt="" fill loading="eager" sizes="24rem" className="object-contain" />
      </div>
      <p className="font-mono text-lg text-sonar">404</p>
      <h1 className="mt-3 text-section text-balance">Nothing echoed back</h1>
      <p className="mt-4 max-w-[45ch] text-lg text-muted">
        This page isn&apos;t here. The link may be old, or the address may have a typo.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
