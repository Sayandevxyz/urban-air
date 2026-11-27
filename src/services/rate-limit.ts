// ============================================================================
// src/services/rate-limit.ts
// Implements in-memory token-bucket rate limiting and trusted IP extraction.
// ============================================================================

import { HTTP_STATUS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Outcome returned by a rate limiter consume check. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly retryAfterSeconds: number;
}

/** Rate limiter contract enabling seamless swap between in-memory and distributed stores. */
export interface RateLimiter {
  consume(key: string): Promise<RateLimitDecision>;
}

interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

const MAX_BUCKET_ENTRIES = 10_000;
const MIN_WINDOW_MS = 1_000;
const MS_PER_SECOND = 1_000;
const MAX_IPV4_OCTET_DIGITS = 3;
const MAX_IPV4_OCTET_VALUE = 255;
const MAX_IP_LENGTH = 45;

/** In-memory token bucket rate limiter keyed by client IP address. */
export class InMemoryTokenBucketRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, TokenBucketState>();
  private readonly capacity: number;
  private readonly refillRatePerMs: number;
  private readonly windowMs: number;
  private readonly maxBuckets: number;
  private readonly now: () => number;

  /** Configures token capacity and refill rate across the specified rolling window. */
  public constructor(options: {
    maxRequests: number;
    windowMs: number;
    maxBuckets?: number;
    now?: () => number;
  }) {
    this.capacity = Math.max(1, options.maxRequests);
    this.windowMs = Math.max(MIN_WINDOW_MS, options.windowMs);
    this.maxBuckets = Math.max(1, options.maxBuckets ?? MAX_BUCKET_ENTRIES);
    this.refillRatePerMs = this.capacity / this.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  /** Consumes one token for the given key or returns retry timing when exhausted. */
  public consume(key: string): Promise<RateLimitDecision> {
    const currentTime = this.now();
    const bucket = this.getOrCreateBucket(key, currentTime);

    const elapsedMs = Math.max(0, currentTime - bucket.lastRefillMs);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedMs * this.refillRatePerMs);
    bucket.lastRefillMs = currentTime;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return Promise.resolve({
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        limit: this.capacity,
        retryAfterSeconds: 0,
      });
    }

    const deficit = 1 - bucket.tokens;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(deficit / (this.refillRatePerMs * MS_PER_SECOND)),
    );
    return Promise.resolve({
      allowed: false,
      remaining: 0,
      limit: this.capacity,
      retryAfterSeconds,
    });
  }

  /** Clears all tracked client buckets (for tests). */
  public reset(): void {
    this.buckets.clear();
  }

  private getOrCreateBucket(key: string, currentTime: number): TokenBucketState {
    const existing = this.buckets.get(key);
    if (existing) {
      return existing;
    }

    if (this.buckets.size >= this.maxBuckets) {
      this.pruneOldest(currentTime);
    }

    const created: TokenBucketState = { tokens: this.capacity, lastRefillMs: currentTime };
    this.buckets.set(key, created);
    return created;
  }

  private pruneOldest(currentTime: number): void {
    for (const [bucketKey, state] of this.buckets.entries()) {
      if (currentTime - state.lastRefillMs > this.windowMs) {
        this.buckets.delete(bucketKey);
      }
      if (this.buckets.size < this.maxBuckets) {
        return;
      }
    }
    const oldestKey = this.buckets.keys().next().value;
    if (oldestKey !== undefined) {
      this.buckets.delete(oldestKey);
    }
  }
}

const IPV4_SEGMENT_PATTERN = /^\d+\.\d+\.\d+\.\d+$/;
const IPV6_PATTERN = /^[0-9a-fA-F:]{2,45}$/;

function isValidIpv4(ip: string): boolean {
  if (!IPV4_SEGMENT_PATTERN.test(ip)) return false;
  return ip.split(".").every((part) => {
    if (part.length > MAX_IPV4_OCTET_DIGITS) return false;
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= MAX_IPV4_OCTET_VALUE;
  });
}

/** Validates IPv4 or IPv6 syntax before keying a client rate-limit bucket. */
export function isValidIpAddress(candidate: string): boolean {
  if (candidate.length === 0 || candidate.length > MAX_IP_LENGTH) return false;
  if (isValidIpv4(candidate)) return true;
  return candidate.includes(":") && IPV6_PATTERN.test(candidate);
}

/** Extracts a validated client IP only when TRUST_PROXY=true, resisting spoofing. */
export function extractClientIp(
  headers: Headers,
  trustProxy = getEnv().TRUST_PROXY === "true",
): string {
  if (!trustProxy) {
    return "127.0.0.1";
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim() ?? "";
    if (isValidIpAddress(firstIp)) return firstIp;
  }
  const realIp = headers.get("x-real-ip")?.trim() ?? "";
  if (isValidIpAddress(realIp)) {
    return realIp;
  }
  return "127.0.0.1";
}

/** Enforces a rate limit check and throws a typed 429 AppError if exceeded. */
export async function enforceRateLimit(
  limiter: RateLimiter,
  headers: Headers,
  routeKey: string,
): Promise<RateLimitDecision> {
  const ip = extractClientIp(headers);
  const decision = await limiter.consume(`${routeKey}:${ip}`);
  if (!decision.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      `Too many requests. Please retry in ${decision.retryAfterSeconds} seconds.`,
      HTTP_STATUS.TOO_MANY_REQUESTS,
      { retryAfterSeconds: decision.retryAfterSeconds },
    );
  }
  return decision;
}
