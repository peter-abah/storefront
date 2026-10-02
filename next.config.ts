import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Worktree sits under /home/peter/code/projects which holds an unrelated
  // package-lock.json — pin tracing root here to silence the warning.
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
