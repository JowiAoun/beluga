import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Made by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson" });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-atkinson-mono" });

// Sets Pause motion from the last visit before the first paint, so nothing moves for a moment first.
const MOTION_SCRIPT = `try{if(localStorage.getItem("beluga-motion")==="paused")document.documentElement.dataset.motion="paused"}catch(e){}`;

export const metadata: Metadata = {
  title: "beluga",
  description:
    "Directional obstacle sounds for blind and low-vision pedestrians, and a fix-first hazard map for the city.",
  applicationName: "beluga",
};

export const viewport: Viewport = {
  themeColor: "#0b1320",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-CA"
      className={`${atkinson.variable} ${atkinsonMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
