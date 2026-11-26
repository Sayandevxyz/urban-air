import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  InMemoryTokenBucketRateLimiter,
  enforceRateLimit,
  extractClientIp,
} from "@/services/rate-limit";

describe("InMemoryTokenBucketRateLimiter", () => {
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

  it("extracts client IP safely and throws typed 429 AppError when limit exceeded", async () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
    expect(extractClientIp(headers)).toBe("203.0.113.10");
    expect(extractClientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(extractClientIp(new Headers())).toBe("127.0.0.1");

    const limiter = new InMemoryTokenBucketRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    await enforceRateLimit(limiter, headers, "test");
    await expect(enforceRateLimit(limiter, headers, "test")).rejects.toThrow(AppError);
  });
});
