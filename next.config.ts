import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // map.beluga.surf opens the city dashboard (Phase 10).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", has: [{ type: "host", value: "map.beluga.surf" }], destination: "/map" }],
      afterFiles: [],
      fallback: [],
    };
  },
  // The service worker always comes fresh from the network, so a new version reaches every phone.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
