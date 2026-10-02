// Server-only — never import from client components. ("server-only"
// package intentionally not added; this header + server-side imports only.)
// Reads admin mailbox routing from the admin_users DB table
// (lib/db/admin-auth-schema.ts: email unique, createdAt). Env stays the
// explicit operator override — callers check env first, then fall through
// to firstAdminDbEmail() (earliest createdAt), then their own fallback.

import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUser } from "@/lib/db/admin-auth-schema";
import { DRAFT_SUPPORT_EMAIL } from "@/lib/contact";

/** All admin emails ordered by createdAt asc (first admin = index 0). */
export async function getAdminDbEmails(): Promise<string[]> {
  try {
    const rows = await db
      .select({ email: adminUser.email })
      .from(adminUser)
      .orderBy(asc(adminUser.createdAt));
    return rows.map((r) => r.email).filter(Boolean);
  } catch {
    // Stale/unmigrated DB (admin_users missing) must never break mailers.
    return [];
  }
}

/** Earliest-created admin email, or null when none / DB unreachable. */
export async function firstAdminDbEmail(): Promise<string | null> {
  try {
    const rows = await db
      .select({ email: adminUser.email })
      .from(adminUser)
      .orderBy(asc(adminUser.createdAt))
      .limit(1);
    return rows[0]?.email || null;
  } catch {
    return null;
  }
}

/**
 * DB-aware support email: OWNER_EMAIL → ADMIN_EMAILS[0] → DB first admin
 * (admin_users ordered by createdAt asc) → DRAFT. Explicit env always wins
 * (operator override); the DB only fills the gap when env is unset.
 */
export async function supportEmailAsync(): Promise<string> {
  const fromEnv =
    process.env.OWNER_EMAIL?.trim() ||
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] ||
    null;
  if (fromEnv) return fromEnv;
  return (await firstAdminDbEmail()) || DRAFT_SUPPORT_EMAIL;
}
