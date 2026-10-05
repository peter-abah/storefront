import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

// Dual-driver client: Neon (serverless, neon-http) for prod + local Docker
// Postgres (postgres-js TCP) for dev. Same Drizzle schema + same migrations
// run against either URL — deploy is an env swap only, no code change.
//
// - DATABASE_URL contains "neon.tech" → neon-http (Vercel/prod).
// - Anything else (e.g. postgresql://maison:maison@localhost:5432/maison)
//   → postgres-js against local Docker (`docker compose up -d db`).
//
// NOTE: `.env.local` may ship empty; `next build` evaluates this module,
// so a missing value falls back to a dummy string that lets the build pass.
// Any real query without credentials fails at runtime.
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@ep-placeholder.neon.tech/neondb?sslmode=require";

const isNeon = connectionString.includes("neon.tech");

export const db = isNeon
  ? drizzleNeon(neon(connectionString), { schema })
  : drizzlePg(postgres(connectionString, { max: 10 }), { schema });

export const dbDriver: "neon-http" | "postgres-js" = isNeon
  ? "neon-http"
  : "postgres-js";
