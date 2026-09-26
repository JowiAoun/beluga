import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Instrument_Serif, Mona_Sans } from "next/font/google";
import "./globals.css";

// Made by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson" });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-atkinson-mono" });
// Headings only: a heavy sans, with a thin serif for the words a heading leans on.
const mona = Mona_Sans({ subsets: ["latin"], variable: "--font-mona" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument" });

// Sets Pause motion from the last visit before the first paint, so nothing moves for a moment first.
const MOTION_SCRIPT = `try{if(localStorage.getItem("beluga-motion")==="paused")document.documentElement.dataset.motion="paused"}catch(e){}`;

export const metadata: Metadata = {
  title: "beluga",
  description:
    "Directional obstacle sounds for blind and low-vision pedestrians, and a fix-first hazard map for the city.",
  applicationName: "beluga",
};

export const viewport: Viewport = {
  themeColor: "#1b232c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-CA"
      className={`${atkinson.variable} ${atkinsonMono.variable} ${mona.variable} ${instrument.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
