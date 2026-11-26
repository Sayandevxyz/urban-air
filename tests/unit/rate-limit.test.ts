import { afterEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  InMemoryTokenBucketRateLimiter,
  enforceRateLimit,
  extractClientIp,
  isValidIpAddress,
} from "@/services/rate-limit";

describe("InMemoryTokenBucketRateLimiter", () => {
  const prevTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prevTrustProxy;
    resetEnvCache();
  });

  it("allows burst up to capacity, blocks with Retry-After, and refills over time", async () => {
    let now = 10_000;
    const limiter = new InMemoryTokenBucketRateLimiter({
      maxRequests: 2,
      windowMs: 10_000,
      now: () => now,
    });

    const first = await limiter.consume("ip1");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = await limiter.consume("ip1");
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const blocked = await limiter.consume("ip1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    now += 5_500;
    const refilled = await limiter.consume("ip1");
    expect(refilled.allowed).toBe(true);

    limiter.reset();
  });

  it("ignores spoofed proxy headers when TRUST_PROXY is false and validates IPs when true", async () => {
    const spoofedHeaders = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.7",
    });

    expect(extractClientIp(spoofedHeaders, false)).toBe("127.0.0.1");
    expect(extractClientIp(spoofedHeaders, true)).toBe("203.0.113.10");
    expect(extractClientIp(new Headers({ "x-real-ip": "198.51.100.7" }), true)).toBe(
      "198.51.100.7",
    );
    expect(extractClientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }), true)).toBe(
      "2001:db8::1",
    );
    expect(extractClientIp(new Headers({ "x-forwarded-for": "999.999.1.1;evil" }), true)).toBe(
      "127.0.0.1",
    );
    expect(extractClientIp(new Headers(), true)).toBe("127.0.0.1");

    expect(isValidIpAddress("192.0.2.1")).toBe(true);
    expect(isValidIpAddress("1000.0.0.1")).toBe(false);
    expect(isValidIpAddress("256.0.0.1")).toBe(false);
    expect(isValidIpAddress("not-an-ip")).toBe(false);
    expect(isValidIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334:extra:long")).toBe(false);
    expect(extractClientIp(new Headers({ "x-forwarded-for": ", 1.2.3.4" }), true)).toBe(
      "127.0.0.1",
    );

    process.env.TRUST_PROXY = "true";
    resetEnvCache();
    const limiter = new InMemoryTokenBucketRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    await enforceRateLimit(limiter, spoofedHeaders, "test");
    await expect(enforceRateLimit(limiter, spoofedHeaders, "test")).rejects.toThrow(AppError);
  });

  it("enforces maxBuckets cap and evicts stale or oldest buckets", async () => {
    let now = 0;
    const bounded = new InMemoryTokenBucketRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
      maxBuckets: 2,
      now: () => now,
    });
    await bounded.consume("k1");
    await bounded.consume("k2");
    // Exhaust k1 so we verify eviction clears its exhausted bucket when capacity forces pruning.
    expect((await bounded.consume("k1")).allowed).toBe(false);

    await bounded.consume("k3");
    // k1 (oldest) was evicted, so k1 receives a fresh bucket on next consume.
    expect((await bounded.consume("k1")).allowed).toBe(true);

    now += 2_000;
    await bounded.consume("k4");
    expect((await bounded.consume("k2")).allowed).toBe(true);
  });
});
