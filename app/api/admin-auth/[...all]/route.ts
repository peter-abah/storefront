import { toNextJsHandler } from "better-auth/next-js";
import { adminAuth } from "@/lib/admin-auth";

// Isolated admin handler — serves /api/admin-auth/* only.
// Shopper OAuth stays on /api/auth/* (lib/auth.ts).
export const { GET, POST } = toNextJsHandler(adminAuth);
