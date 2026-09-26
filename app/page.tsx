import Link from "next/link";

const SOURCE = "https://github.com/AshwinSri23/beluga";

const STEPS = [
  {
    title: "Depth on the phone",
    text: "Chrome's WebXR and ARCore depth measure everything in a narrow walking corridor, ten times a second. This part never touches the network.",
  },
  {
    title: "Sounds from the obstacle's side",
    text: "A short sound plays from the side of what is in the way and repeats faster as it gets closer, made for bone-conduction earbuds that keep the ears open to traffic. Drop-offs and head-height hazards have their own sounds.",
  },
  {
    title: "Ask, and civic triage",
    text: "A tap on Ask sends one camera frame to an ElevenLabs agent that sees with Gemini, and the answer is spoken from the object's side. The same kind of agent answers questions about lasting hazards, and fixed rules decide what gets reported.",
  },
  {
    title: "A fix-first list for the city",
    text: "With consent, anonymous reports rounded to about 100 m land in Tiger Data. Continuous aggregates rank the spots worth fixing first around Ottawa's O-Train stations.",
  },
];

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
        <Link
          href="/map"
          className="flex min-h-16 items-center justify-center rounded-lg border-2 border-accent px-6 text-lg font-bold"
        >
          City dashboard
        </Link>
        <a
          href={SOURCE}
          className="flex min-h-16 items-center justify-center rounded-lg border-2 border-neutral-500 px-6 text-lg font-bold"
        >
          Source code
        </a>
      </nav>
      <section aria-labelledby="how" className="flex flex-col gap-3">
        <h2 id="how" className="text-2xl font-bold">
          How it works
        </h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="font-semibold">
                {i + 1}. {step.title}
              </p>
              <p className="opacity-90">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm opacity-80">
          Built with WebXR and ARCore in Chrome for Android, Web Audio, MediaPipe, ElevenLabs agents and sounds,
          Gemini, Tiger Data (TimescaleDB and PostGIS), Next.js on Vercel, and the beluga.surf domain from GoDaddy
          Registry.
        </p>
      </section>
    </main>
  );
}
