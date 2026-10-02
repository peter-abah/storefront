import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

// Wave 1 skeleton — Google-only, no admin plugin (per PRD F4 / ADR-004).
// Full wiring (auth-schema generation, profiles upsert, ADMIN_EMAILS
// allowlist) lands in Wave 2 once DATABASE_URL + Google OAuth creds exist.
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // nextCookies() MUST stay last so Server Actions see the session.
  plugins: [nextCookies()],
});
