import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Default basePath ([...all]) — keeps the OAuth callback at
// /api/auth/callback/google, matching the Google Cloud Console
// redirect registered for this app (avoids redirect_uri_mismatch).
export const { GET, POST } = toNextJsHandler(auth);
