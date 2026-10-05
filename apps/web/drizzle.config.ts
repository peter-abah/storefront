import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

// Migrate/generate credentials: unpooled URL for Neon (DDL-safe),
// plain DATABASE_URL otherwise. Local Docker: DATABASE_URL_UNPOOLED empty
// → falls back to DATABASE_URL (localhost). Same dialect, same migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Empty string counts as missing (local .env leaves UNPOOLED blank).
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!,
  },
});
