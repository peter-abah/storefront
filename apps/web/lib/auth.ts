import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

// Shopper auth — Google-only (per PRD F4 / ADR-004). Profiles are always
// customer here; admin access lives on the isolated instance
// (lib/admin-auth.ts). ADMIN_EMAILS is mail routing only, never promotion.
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: [
    "maison://",
    ...(process.env.NODE_ENV !== "production"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**"]
      : []),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  // nextCookies() MUST stay last so Server Actions see the session.
  plugins: [expo(), bearer(), nextCookies()],
});
