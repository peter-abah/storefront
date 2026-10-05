import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin file tracing to this workspace package so Next.js does not walk up
  // into the monorepo root (or unrelated parent dirs) when collecting files.
  outputFileTracingRoot: __dirname,
  images: {
    // Curated Unsplash stock (seed-mapped per category/room) + Cloudinary
    // (admin uploads + future fetch-migration of the same Unsplash URLs).
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
