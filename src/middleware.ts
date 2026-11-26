import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, generateCspNonce } from "@/services/security-headers";

/**
 * Attaches a per-request CSP nonce and strict security headers to every HTML and API response.
 */
export function middleware(request: NextRequest): NextResponse {
  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV === "development";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const headers = buildSecurityHeaders(nonce, isDev);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
