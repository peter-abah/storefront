import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @maison/shared ships TypeScript source (main: ./src/index.ts); Next must
  // compile it alongside the app for RSC, route handlers and server actions.
  transpilePackages: ["@maison/shared"],
  // Pin file tracing to the monorepo root so pnpm's root .pnpm store is
  // included in the serverless bundle instead of being excluded.
  outputFileTracingRoot: resolve(__dirname, "../.."),
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
