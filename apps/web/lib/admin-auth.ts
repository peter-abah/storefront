import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { count } from "drizzle-orm";
import { db } from "./db";
import {
  adminAccount,
  adminSession,
  adminUser,
  adminVerification,
} from "./db/admin-auth-schema";

// Fully separate admin auth — second Better Auth instance, isolated from
// shopper auth (lib/auth.ts):
// - basePath /api/admin-auth (shopper stays /api/auth)
// - email+password only, no social providers
// - cookie prefix "admin" → session cookie "admin.session_token"
//   (+ "__Secure-admin.session_token" in prod), never collides with
//   shopper "better-auth.session_token"
// - tables admin_users/admin_sessions/admin_accounts/admin_verifications
//   via drizzleAdapter schema mapping — zero shared rows with shoppers
// - brute-force throttle via Better Auth rateLimit customRules on the
//   credential endpoints (5 sign-in/min, 3 sign-up + reset/min)
export const adminAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/admin-auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: adminUser,
      session: adminSession,
      account: adminAccount,
      verification: adminVerification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    minPasswordLength: 8,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // No shopper email changes: log the reset URL server-side.
      // Wire to the transactional provider when admin mail is configured.
      console.log(`[admin-auth] password reset for ${user.email}: ${url}`);
    },
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "memory",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // First-login bootstrap gate: the very first admin (zero rows)
        // may self-register as owner. Once one exists, public sign-up
        // is rejected — further admins are created by SQL/owner tooling.
        before: async () => {
          try {
            const rows = await db.select({ value: count() }).from(adminUser);
            if ((rows[0]?.value ?? 0) > 0) return false;
          } catch {
            // If the count query fails (e.g. migration not yet applied),
            // fail closed rather than opening public admin sign-up.
            return false;
          }
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "admin",
  },
  // nextCookies() MUST stay last so Server Actions see the admin session.
  plugins: [nextCookies()],
});

export type AdminAuth = typeof adminAuth;
