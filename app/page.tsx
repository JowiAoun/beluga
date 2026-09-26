import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <h1 className="text-6xl font-bold">beluga</h1>
      <p className="text-xl">
        beluga warns blind and low-vision pedestrians about obstacles with short sounds that come from the
        obstacle&apos;s side. It also turns lasting hazards, like a scooter left across the sidewalk, into a
        fix-first list for the city.
      </p>
      <p className="rounded-lg border-2 border-accent p-4">
        beluga is a research prototype built at Hack the Hill III. It is not a medical device. Use it alongside
        your white cane or guide dog, never in place of them.
      </p>
      <nav className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/walk"
          className="flex min-h-16 items-center justify-center rounded-lg bg-accent px-6 text-lg font-bold text-black"
        >
          Try beluga (Android Chrome)
        </Link>
      </nav>
    </main>
  );
}
