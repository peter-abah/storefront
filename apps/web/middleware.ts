import { NextResponse, type NextRequest } from "next/server";

// Split cookie-presence gates (Edge-safe, no DB / no Better Auth imports).
// - Shopper routes (/checkout, /orders): shopper cookie
//   better-auth.session_token → else /login (shopper flow untouched).
// - Admin routes (/admin, except /admin/login*): isolated admin cookie
//   admin.session_token (cookiePrefix "admin") → else /admin/login.
// Full session validation stays in pages / Server Actions (Node runtime)
// via getSessionProfile (shopper) and getAdminSession (admin).
const SHOPPER_SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

const ADMIN_SESSION_COOKIES = [
  "admin.session_token",
  "__Secure-admin.session_token",
];

function hasCookie(req: NextRequest, names: string[]): boolean {
  return names.some((name) => req.cookies.has(name));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Admin login + reset are public — otherwise the gate would loop.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (hasCookie(req, ADMIN_SESSION_COOKIES)) return NextResponse.next();
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("callbackURL", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Shopper gate — Paystack/checkout untouched beyond the cookie split.
  if (hasCookie(req, SHOPPER_SESSION_COOKIES)) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("callbackURL", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/checkout",
    "/checkout/:path*",
    "/orders",
    "/orders/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
