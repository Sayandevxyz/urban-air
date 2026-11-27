import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { fetchJsonWithGuard } from "@/services/http";
import { buildSecurityHeaders, generateCspNonce } from "@/services/security-headers";
import { assertAllowedUpstreamUrl } from "@/services/ssrf-guard";

describe("security: SSRF protection and CSP headers", () => {
  it("allows only HTTPS URLs on explicitly allowlisted hosts", () => {
    const allowed = assertAllowedUpstreamUrl(
      "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.61",
    );
    expect(allowed.hostname).toBe("air-quality-api.open-meteo.com");
  });

  it("blocks SSRF attempts targeting internal IPs, localhost, HTTP, credentials, or unknown domains", () => {
    const blockedTargets = [
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

    for (const target of blockedTargets) {
      expect(() => assertAllowedUpstreamUrl(target)).toThrow(AppError);
    }
  });

  it("returns SSRF_BLOCKED Result when fetchJsonWithGuard receives blocked URL", async () => {
    const result = await fetchJsonWithGuard("http://169.254.169.254/latest", z.object({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
  });

  it("generates unique nonces and strict CSP headers without unsafe-inline scripts or styles", () => {
    const n1 = generateCspNonce();
    const n2 = generateCspNonce();
    expect(n1).not.toBe(n2);
    expect(n1.length).toBeGreaterThan(10);

    const prodHeaders = buildSecurityHeaders(n1, false);
    const csp = prodHeaders["Content-Security-Policy"] ?? "";
    expect(csp).toContain(`script-src 'self' 'nonce-${n1}'`);
    expect(csp).toContain(`style-src 'self' 'nonce-${n1}'`);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(prodHeaders["X-Content-Type-Options"]).toBe("nosniff");
    expect(prodHeaders["X-Frame-Options"]).toBe("DENY");
    expect(prodHeaders["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(prodHeaders["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(prodHeaders["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(prodHeaders["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(prodHeaders["X-DNS-Prefetch-Control"]).toBe("off");
  });
});
