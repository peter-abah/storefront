"use client";

import { createAuthClient } from "better-auth/react";

// Admin-only client — points at the isolated /api/admin-auth basePath with
// the "admin" cookie prefix. Never used for shopper flows; the header
// AuthIsland keeps using lib/auth-client (shopper signOut).
export const adminAuthClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  basePath: "/api/admin-auth",
});

export const {
  signIn: adminSignIn,
  signOut: adminSignOut,
  useSession: useAdminSession,
} = adminAuthClient;
