import type { Viewport } from "next";

// The walk pages draw into the strip at the top of a phone (the status bar and the camera cutout)
// instead of leaving it black, and move their content below it with `pt-safe`. The installed app
// opens here, full screen.
export const viewport: Viewport = { viewportFit: "cover" };

export default function WalkLayout({ children }: LayoutProps<"/walk">) {
  return children;
}
