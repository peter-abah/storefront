import { NextResponse, type NextRequest } from "next/server";

// Wave 1: Edge-safe cookie-PRESENCE gate only. No DB, no Better Auth
// imports here (Node-only). Full session + role validation stays in
// pages / Server Actions (Node runtime) in later waves.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.has(name));
}

export function middleware(req: NextRequest) {
  if (hasSessionCookie(req)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set(
    "callbackURL",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/checkout/:path*", "/orders/:path*", "/admin/:path*"],
};
