"use client";

import { createAuthClient } from "better-auth/react";

// Wave 1 skeleton — client used for `signIn.social({ provider: "google" })`
// and `useSession` once Wave 2 enables Google OAuth.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession } = authClient;
