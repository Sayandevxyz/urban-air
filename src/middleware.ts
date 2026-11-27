// ============================================================================
// src/middleware.ts
// Issues per-request cryptographic CSP nonces and hardens response headers.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, generateCspNonce } from "@/services/security";

/**
 * Attaches a per-request CSP nonce via internal request headers and strict security headers on responses.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV === "development";
  const headers = buildSecurityHeaders(nonce, isDev);
  const csp = headers["Content-Security-Policy"] ?? "";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

/** Next.js matcher excluding static build assets from CSP header injection. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
