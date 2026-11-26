import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import HomePage from "@/app/page";
import { logger } from "@/lib/logger";
import { middleware } from "@/middleware";
import { getDemoAirQualityReport, searchDemoCities } from "@/services/demo-data";
import { fetchJsonWithGuard } from "@/services/http";
import { InMemoryTokenBucketRateLimiter } from "@/services/rate-limit";
import { buildSecurityHeaders } from "@/services/security-headers";

describe("services edge cases, middleware, and RSC entry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("middleware sets CSP nonce internally without echoing x-nonce on HTTP responses", () => {
    const req = new NextRequest("https://localhost:3000/");
    const res = middleware(req);
    expect(res.headers.get("content-security-policy")).toContain("script-src");
    expect(res.headers.get("content-security-policy")).toContain("style-src");
    expect(res.headers.get("x-nonce")).toBeNull();
    expect(res.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(res.headers.get("x-dns-prefetch-control")).toBe("off");

    const apiRes = middleware(new NextRequest("https://localhost:3000/api/health"));
    expect(apiRes.headers.get("cache-control")).toBe("no-store");

    const devHeaders = buildSecurityHeaders("abc123", true);
    expect(devHeaders["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });

  it("fetchJsonWithGuard enforces byte limits and timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-length": "99999999" },
          }),
        ),
      ),
    );
    const tooLargeHeader = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({ ok: z.boolean() }),
    );
    expect(tooLargeHeader.ok).toBe(false);
    if (!tooLargeHeader.ok) {
      expect(tooLargeHeader.error.code).toBe("PAYLOAD_TOO_LARGE");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    );
    const timedOut = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({}),
      { timeoutMs: 15 },
    );
    expect(timedOut.ok).toBe(false);
    if (!timedOut.ok) {
      expect(timedOut.error.code).toBe("UPSTREAM_TIMEOUT");
    }

    // Stream chunk limit without content-length header
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(stream, { status: 200 }))),
    );
    const chunkLimit = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({}),
      { maxBytes: 64 },
    );
    expect(chunkLimit.ok).toBe(false);
    if (!chunkLimit.ok) {
      expect(chunkLimit.error.code).toBe("PAYLOAD_TOO_LARGE");
    }

    // Pre-aborted external signal
    const preAborted = new AbortController();
    preAborted.abort();
    const preRes = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({}),
      { signal: preAborted.signal },
    );
    expect(preRes.ok).toBe(false);

    // Null stream fallback reading text() with oversize check & 429 without Retry-After header
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: null,
          text: () => Promise.resolve("x".repeat(128)),
        } as unknown as Response),
      ),
    );
    const noStreamTooLarge = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({}),
      { maxBytes: 32 },
    );
    expect(noStreamTooLarge.ok).toBe(false);
    if (!noStreamTooLarge.ok) {
      expect(noStreamTooLarge.error.code).toBe("PAYLOAD_TOO_LARGE");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          body: null,
          text: () => Promise.resolve('{"ok":true}'),
        } as unknown as Response),
      ),
    );
    const noStreamOk = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({ ok: z.boolean() }),
    );
    expect(noStreamOk.ok).toBe(true);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 429 }))),
    );
    const default429 = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({}),
    );
    expect(default429.ok).toBe(false);
    if (!default429.ok) {
      expect(default429.error.retryAfterSeconds).toBe(60);
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ wrong: true }), { status: 200 }))),
    );
    const schemaMismatch = await fetchJsonWithGuard(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
      z.object({ ok: z.boolean() }),
    );
    expect(schemaMismatch.ok).toBe(false);
  });

  it("demo-data searches empty query and resolves closest seeded city for custom coords", () => {
    expect(searchDemoCities("")).toHaveLength(5);
    const custom = getDemoAirQualityReport({
      key: "custom",
      name: "Near Delhi",
      region: "",
      country: "",
      latitude: 28.5,
      longitude: 77.1,
      timezone: "UTC",
    });
    expect(custom.current.usAqi).toBe(224);
  });

  it("rate limiter prunes buckets safely and logger writes warn/error/debug", async () => {
    let now = 0;
    const limiter = new InMemoryTokenBucketRateLimiter({
      maxRequests: 5,
      windowMs: 1_000,
      now: () => now,
    });
    await limiter.consume("a");
    now += 2_000;
    await limiter.consume("b");

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";
    logger.debug("dbg");
    logger.warn("wrn");
    logger.error("err");
    expect(stdoutSpy).toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    if (prev === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = prev;
    }
  });

  it("HomePage renders UrbanAirWorkbench", () => {
    const element = HomePage();
    expect(element).toBeTruthy();
  });
});
