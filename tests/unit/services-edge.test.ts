// ============================================================================
// tests/unit/services-edge.test.ts
// Tests middleware headers, fetchJsonWithGuard size/timeout edges, & demo math.
// ============================================================================

import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import HomePage from "@/app/page";
import { logger } from "@/lib/logger";
import { middleware } from "@/middleware";
import { getDemoAirQualityReport, searchDemoCities } from "@/services/demo-data";
import { fetchJsonWithGuard } from "@/services/http";
import { InMemoryTokenBucketRateLimiter } from "@/services/rate-limit";
import { buildSecurityHeaders } from "@/services/security";

const URL_AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";

afterEach(() => {
  vi.restoreAllMocks();
});

test("middleware attaches nonce CSP without x-nonce header echo and sets API no-store", () => {
  const res = middleware(new NextRequest("https://localhost:3000/"));
  expect(res.headers.get("content-security-policy")).toContain("script-src");
  expect(res.headers.get("x-nonce")).toBeNull();
  expect(res.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
  expect(res.headers.get("x-frame-options")).toBe("DENY");
  expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
  expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(res.headers.get("x-dns-prefetch-control")).toBe("off");
  expect(
    middleware(new NextRequest("https://localhost:3000/api/health")).headers.get("cache-control"),
  ).toBe("no-store");
  expect(buildSecurityHeaders("abc123", true)["Content-Security-Policy"]).toContain(
    "'unsafe-eval'",
  );
});

const abortableFetchMock = (_u: string, init?: RequestInit) =>
  new Promise<Response>((_r, rej) => {
    if (init?.signal?.aborted) {
      rej(new DOMException("Aborted", "AbortError"));
      return;
    }
    init?.signal?.addEventListener("abort", () => {
      rej(new DOMException("Aborted", "AbortError"));
    });
  });

test("fetchJsonWithGuard enforces header/stream byte limits and aborts cleanly", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response("{}", { status: 200, headers: { "content-length": "99999999" } }),
      ),
    ),
  );
  const tooLarge = await fetchJsonWithGuard(URL_AQ, z.object({}));
  expect(!tooLarge.ok && tooLarge.error.code).toBe("PAYLOAD_TOO_LARGE");

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(200));
      c.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(stream, { status: 200 }))),
  );
  const chunkLimit = await fetchJsonWithGuard(URL_AQ, z.object({}), { maxBytes: 64 });
  expect(!chunkLimit.ok && chunkLimit.error.code).toBe("PAYLOAD_TOO_LARGE");

  vi.stubGlobal("fetch", vi.fn(abortableFetchMock));
  const timedOut = await fetchJsonWithGuard(URL_AQ, z.object({}), { timeoutMs: 15 });
  expect(!timedOut.ok && timedOut.error.code).toBe("UPSTREAM_TIMEOUT");

  const preAborted = new AbortController();
  preAborted.abort();
  expect((await fetchJsonWithGuard(URL_AQ, z.object({}), { signal: preAborted.signal })).ok).toBe(
    false,
  );
});

test("fetchJsonWithGuard handles null-body text() fallbacks, 429 defaults, and schema errors", async () => {
  const nullBodyRes = (text: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text: () => Promise.resolve(text),
    } as unknown as Response);

  vi.stubGlobal(
    "fetch",
    vi.fn(() => nullBodyRes("x".repeat(128))),
  );
  const tooBig = await fetchJsonWithGuard(URL_AQ, z.object({}), { maxBytes: 32 });
  expect(!tooBig.ok && tooBig.error.code).toBe("PAYLOAD_TOO_LARGE");

  vi.stubGlobal(
    "fetch",
    vi.fn(() => nullBodyRes('{"ok":true}')),
  );
  expect((await fetchJsonWithGuard(URL_AQ, z.object({ ok: z.boolean() }))).ok).toBe(true);

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status: 429 }))),
  );
  const def429 = await fetchJsonWithGuard(URL_AQ, z.object({}));
  expect(!def429.ok && def429.error.retryAfterSeconds).toBe(60);

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ wrong: true }), { status: 200 }))),
  );
  expect((await fetchJsonWithGuard(URL_AQ, z.object({ ok: z.boolean() }))).ok).toBe(false);
});

test("demo-data fallback, limiter pruning, logger levels, and HomePage RSC render work", async () => {
  expect(searchDemoCities("")).toHaveLength(5);
  expect(getDemoAirQualityReport("unknown-city").location.key).toBe("delhi");
  expect(
    getDemoAirQualityReport({
      key: "custom",
      name: "Near Delhi",
      region: "",
      country: "",
      latitude: 28.5,
      longitude: 77.1,
      timezone: "UTC",
    }).current.usAqi,
  ).toBe(224);

  let now = 0;
  const limiter = new InMemoryTokenBucketRateLimiter({
    maxRequests: 5,
    windowMs: 1_000,
    now: () => now,
  });
  await limiter.consume("a");
  now += 2_000;
  await limiter.consume("b");

  const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const outSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const prev = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = "debug";
  logger.debug("d");
  logger.warn("w");
  logger.error("e");
  expect(outSpy).toHaveBeenCalled();
  expect(errSpy).toHaveBeenCalledTimes(2);
  if (prev === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = prev;
  expect(HomePage()).toBeTruthy();
});
