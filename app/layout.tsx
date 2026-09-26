import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en-CA" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
