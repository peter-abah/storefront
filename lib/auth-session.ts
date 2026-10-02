import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { adminAuth } from "./admin-auth";
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

export type AdminSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
};

/**
 * DEPRECATED for admin access: ADMIN_EMAILS auto-promote no longer grants
 * admin. Admin auth is fully separate (lib/admin-auth.ts + admin_users
 * tables + /admin/login). This helper stays shopper-only — it upserts a
 * customer profile and never promotes. Shopper checkout/orders/cart flows
 * are unchanged.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const u = session?.user;
  if (!u?.id || !u?.email) return null;

  const email = u.email;

  const existing = (
    await db.select().from(profiles).where(eq(profiles.id, u.id)).limit(1)
  )[0];

  if (existing) return { user: mapUser(u), profile: existing };

  const role = "customer";
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

/**
 * Admin session helper — reads the isolated admin Better Auth instance
 * ONLY (admin.session_token cookie → admin_users tables). Never touches
 * shopper user/session/account or profiles. Used by app/admin/layout.tsx
 * and lib/actions/admin.ts.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await adminAuth.api.getSession({
    headers: await headers(),
  });
  const u = session?.user;
  if (!u?.id || !u?.email) return null;
  return {
    user: { id: u.id, email: u.email, name: u.name, image: u.image },
  };
}

/** Redirect non-admins to /admin/login (param name matches middleware.ts). */
export async function requireAdmin(
  callbackURL = "/admin",
): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s)
    redirect(`/admin/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  return s;
}

function mapUser(u: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}): SessionProfile["user"] {
  return { id: u.id, email: u.email, name: u.name, image: u.image };
}
