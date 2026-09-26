import type { MetadataRoute } from "next";

// No orientation lock yet: the Phase 0 field-of-view test picks portrait or landscape.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "beluga",
    short_name: "beluga",
    description: "Directional obstacle sounds for blind and low-vision pedestrians.",
    start_url: "/walk",
    scope: "/",
    display: "fullscreen",
    background_color: "#0b1320",
    theme_color: "#0b1320",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
