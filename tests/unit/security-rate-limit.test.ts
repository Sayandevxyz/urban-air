// ============================================================================
// tests/unit/security-rate-limit.test.ts
// Tests SSRF allowlists, CSP header hardening, and IP rate-limit enforcement.
// ============================================================================

import { afterEach, expect, test } from "vitest";
import { z } from "zod";
import { resetEnvCache } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { fetchJsonWithGuard } from "@/services/http";
import {
  InMemoryTokenBucketRateLimiter,
  enforceRateLimit,
  extractClientIp,
  isValidIpAddress,
} from "@/services/rate-limit";
import {
  assertAllowedUpstreamUrl,
  buildSecurityHeaders,
  generateCspNonce,
} from "@/services/security";

const prevTrustProxy = process.env.TRUST_PROXY;

afterEach(() => {
  if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = prevTrustProxy;
  resetEnvCache();
});

test("assertAllowedUpstreamUrl and fetchJsonWithGuard enforce strict HTTPS allowlist", async () => {
  const okUrl = assertAllowedUpstreamUrl(
    "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.61",
  );
  expect(okUrl.hostname).toBe("air-quality-api.open-meteo.com");

  const blocked = [
    "http://air-quality-api.open-meteo.com/v1/air-quality",
    "https://127.0.0.1/latest",
    "https://localhost:3000/api/health",
    "https://169.254.169.254/latest/meta-data/",
    "https://10.0.0.1/internal",
    "https://192.168.1.1/admin",
    "https://user:pass@air-quality-api.open-meteo.com/v1",
    "https://attacker.example.com/exfiltrate",
    "not-a-valid-url",
  ];
  for (const target of blocked) expect(() => assertAllowedUpstreamUrl(target)).toThrow(AppError);

  const res = await fetchJsonWithGuard("http://169.254.169.254/latest", z.object({}));
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.error.code).toBe("SSRF_BLOCKED");
});

test("buildSecurityHeaders pairs unique nonces with strict nonce CSP and isolation headers", () => {
  const n1 = generateCspNonce();
  const n2 = generateCspNonce();
  expect(n1).not.toBe(n2);
  expect(n1.length).toBeGreaterThan(10);

  const headers = buildSecurityHeaders(n1, false);
  const csp = headers["Content-Security-Policy"] ?? "";
  expect(csp).toContain(`script-src 'self' 'nonce-${n1}'`);
  expect(csp).toContain(`style-src 'self' 'nonce-${n1}'`);
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["X-Frame-Options"]).toBe("DENY");
  expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  expect(headers["X-DNS-Prefetch-Control"]).toBe("off");
});

test("token-bucket limiter refills tokens and evicts stale or excess IP buckets", async () => {
  let now = 10_000;
  const limiter = new InMemoryTokenBucketRateLimiter({
    maxRequests: 2,
    windowMs: 10_000,
    now: () => now,
  });
  expect((await limiter.consume("ip1")).remaining).toBe(1);
  expect((await limiter.consume("ip1")).remaining).toBe(0);
  const blocked = await limiter.consume("ip1");
  expect(blocked.allowed).toBe(false);
  expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  now += 5_500;
  expect((await limiter.consume("ip1")).allowed).toBe(true);
  limiter.reset();

  const bounded = new InMemoryTokenBucketRateLimiter({
    maxRequests: 1,
    windowMs: 1_000,
    maxBuckets: 2,
    now: () => now,
  });
  await bounded.consume("k1");
  await bounded.consume("k2");
  expect((await bounded.consume("k1")).allowed).toBe(false);
  await bounded.consume("k3");
  expect((await bounded.consume("k1")).allowed).toBe(true);
  now += 2_000;
  await bounded.consume("k4");
  expect((await bounded.consume("k2")).allowed).toBe(true);
});

test("extractClientIp honors TRUST_PROXY gating and validates IPv4/IPv6 syntax", async () => {
  const spoofed = new Headers({
    "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    "x-real-ip": "198.51.100.7",
  });
  expect(extractClientIp(spoofed, false)).toBe("127.0.0.1");
  expect(extractClientIp(spoofed, true)).toBe("203.0.113.10");
  expect(extractClientIp(new Headers({ "x-real-ip": "198.51.100.7" }), true)).toBe("198.51.100.7");
  expect(extractClientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }), true)).toBe(
    "2001:db8::1",
  );
  expect(extractClientIp(new Headers({ "x-forwarded-for": "999.999.1.1;evil" }), true)).toBe(
    "127.0.0.1",
  );
  expect(extractClientIp(new Headers({ "x-forwarded-for": ", 1.2.3.4" }), true)).toBe("127.0.0.1");
  expect(extractClientIp(new Headers(), true)).toBe("127.0.0.1");

  expect(isValidIpAddress("192.0.2.1")).toBe(true);
  expect(isValidIpAddress("256.0.0.1")).toBe(false);
  expect(isValidIpAddress("1000.0.0.1")).toBe(false);
  expect(isValidIpAddress("not-an-ip")).toBe(false);
  expect(isValidIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra:long")).toBe(false);

  process.env.TRUST_PROXY = "true";
  resetEnvCache();
  const limiter = new InMemoryTokenBucketRateLimiter({ maxRequests: 1, windowMs: 60_000 });
  await enforceRateLimit(limiter, spoofed, "test");
  await expect(enforceRateLimit(limiter, spoofed, "test")).rejects.toThrow(AppError);
});
