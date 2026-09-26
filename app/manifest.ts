import type { MetadataRoute } from "next";

// Portrait, as the Phase 0 field-of-view test measured the Galaxy S22 (38° × 74°) and the phone
// is worn upright on the chest strap. Turning the phone would change the view the sounds are
// tuned for.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "beluga",
    short_name: "beluga",
    description: "Directional obstacle sounds for blind and low-vision pedestrians.",
    start_url: "/walk",
    scope: "/",
    display: "fullscreen",
    orientation: "portrait",
    background_color: "#1b232c",
    theme_color: "#1b232c",
    icons: [
      { src: "/icons/beluga-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/beluga-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/beluga-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/beluga-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
