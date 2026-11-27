// ============================================================================
// src/services/security.ts
// Enforces SSRF URL allowlists, CSP cryptographic nonces, and security headers.
// ============================================================================

import { ALLOWED_UPSTREAM_HOSTS, HTTP_STATUS } from "@/lib/constants";
import { AppError, err, ok, type Result } from "@/lib/errors";

const NONCE_BYTE_LENGTH = 16;
const PRIVATE_IP_OR_LOCAL_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

/** Validates that an outbound URL uses HTTPS on an explicitly allowlisted host (SSRF defense). */
export function assertAllowedUpstreamUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(
      "SSRF_BLOCKED",
      "Blocked malformed outbound request target.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  if (parsed.protocol !== "https:") {
    throw new AppError(
      "SSRF_BLOCKED",
      "Outbound requests must use HTTPS.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new AppError(
      "SSRF_BLOCKED",
      "Outbound URLs must not contain embedded credentials.",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  const blockedHost =
    PRIVATE_IP_OR_LOCAL_PATTERN.test(parsed.hostname) ||
    !ALLOWED_UPSTREAM_HOSTS.includes(parsed.hostname);
  if (blockedHost) {
    throw new AppError(
      "SSRF_BLOCKED",
      `Outbound host "${parsed.hostname}" is not in the security allowlist.`,
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  return parsed;
}

/** Resolves and validates an outbound URL as a discriminated Result without throwing. */
export function safeResolveUpstreamUrl(rawUrl: string): Result<URL> {
  try {
    return ok(assertAllowedUpstreamUrl(rawUrl));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(
      new AppError("SSRF_BLOCKED", "Blocked outbound request.", HTTP_STATUS.BAD_REQUEST, {
        cause: error,
      }),
    );
  }
}

/** Generates a cryptographically strong random CSP nonce for script-src and style-src. */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Builds strict security headers including nonce-gated CSP without unsafe-inline. */
export function buildSecurityHeaders(
  nonce: string,
  isDev: boolean,
): Readonly<Record<string, string>> {
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };
}
