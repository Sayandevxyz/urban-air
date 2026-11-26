import { AppError } from "@/lib/errors";

/**
 * Outcome returned by a rate limiter consume check.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly retryAfterSeconds: number;
}

/**
 * Rate limiter contract enabling seamless swap between in-memory and Redis implementations.
 */
export interface RateLimiter {
  consume(key: string): Promise<RateLimitDecision>;
}

interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

const MAX_BUCKET_ENTRIES = 10_000;

/**
 * In-memory token bucket rate limiter keyed by client IP address.
 */
export class InMemoryTokenBucketRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, TokenBucketState>();
  private readonly capacity: number;
  private readonly refillRatePerMs: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  /**
   * Configures token capacity and refill rate across the specified rolling window.
   */
  public constructor(options: { maxRequests: number; windowMs: number; now?: () => number }) {
    this.capacity = Math.max(1, options.maxRequests);
    this.windowMs = Math.max(1_000, options.windowMs);
    this.refillRatePerMs = this.capacity / this.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Consumes one token for the given key or returns retry timing when bucket is exhausted.
   */
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
    const retryAfterSeconds = Math.max(1, Math.ceil(deficit / (this.refillRatePerMs * 1_000)));
    return Promise.resolve({
      allowed: false,
      remaining: 0,
      limit: this.capacity,
      retryAfterSeconds,
    });
  }

  /**
   * Clears all tracked client buckets (for tests).
   */
  public reset(): void {
    this.buckets.clear();
  }

  private getOrCreateBucket(key: string, currentTime: number): TokenBucketState {
    const existing = this.buckets.get(key);
    if (existing) {
      return existing;
    }

    if (this.buckets.size >= MAX_BUCKET_ENTRIES) {
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
      if (this.buckets.size < MAX_BUCKET_ENTRIES) {
        return;
      }
    }
    const oldestKey = this.buckets.keys().next().value;
    if (oldestKey !== undefined) {
      this.buckets.delete(oldestKey);
    }
  }
}

/**
 * Extracts a normalized client identifier from incoming request headers without trusting spoofed lists.
 */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && firstIp.length <= 64) {
      return firstIp;
    }
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp && realIp.length <= 64) {
    return realIp;
  }
  return "127.0.0.1";
}

/**
 * Enforces a rate limit check and throws a typed 429 AppError if exceeded.
 */
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
      429,
      { retryAfterSeconds: decision.retryAfterSeconds },
    );
  }
  return decision;
}
