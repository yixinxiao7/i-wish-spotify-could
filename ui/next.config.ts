import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Album/playlist artwork is served from Spotify's image CDN.
    remotePatterns: [
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
    ],
  },
};

export default nextConfig;
