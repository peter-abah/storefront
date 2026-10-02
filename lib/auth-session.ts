import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { profiles } from "./db/schema";

export type SessionProfile = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  profile: typeof profiles.$inferSelect;
};

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Wave 4 session helper — Better Auth session + profiles upsert.
 * `nextCookies()` (last plugin in lib/auth.ts) is what makes
 * `auth.api.getSession` see the session inside Server Actions/RSC.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const u = session?.user;
  if (!u?.id || !u?.email) return null;

  const email = u.email;
  const isAdminEmail = adminEmails().includes(email.toLowerCase());

  const existing = (
    await db.select().from(profiles).where(eq(profiles.id, u.id)).limit(1)
  )[0];

  if (existing) {
    // Allowlist wins on every sign-in so a newly-added ADMIN_EMAILS
    // promotes on next request. Never demote from here (manual SQL only).
    if (isAdminEmail && existing.role !== "admin") {
      await db
        .update(profiles)
        .set({ role: "admin" })
        .where(eq(profiles.id, u.id));
      return { user: mapUser(u), profile: { ...existing, role: "admin" } };
    }
    return { user: mapUser(u), profile: existing };
  }

  const role = isAdminEmail ? "admin" : "customer";
  await db
    .insert(profiles)
    .values({
      id: u.id,
      email,
      name: u.name ?? null,
      image: u.image ?? null,
      role,
    })
    .onConflictDoNothing();

  const row = (
    await db.select().from(profiles).where(eq(profiles.id, u.id)).limit(1)
  )[0];

  // Race fallback (concurrent first sign-ins): return the intended shape
  // rather than failing the request.
  if (!row) {
    return {
      user: mapUser(u),
      profile: {
        id: u.id,
        email,
        name: u.name ?? null,
        image: u.image ?? null,
        role,
        createdAt: new Date(),
      },
    };
  }
  return { user: mapUser(u), profile: row };
}

/** Redirect guests to /login (param name matches middleware.ts). */
export async function requireUser(
  callbackURL = "/shop",
): Promise<SessionProfile> {
  const sp = await getSessionProfile();
  if (!sp) redirect(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  return sp;
}

function mapUser(u: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): SessionProfile["user"] {
  return { id: u.id, email: u.email, name: u.name, image: u.image };
}
