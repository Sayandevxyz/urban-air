import { MAX_CACHE_ENTRIES } from "@/lib/constants";
import { logger } from "@/lib/logger";

interface CacheRecord<T> {
  readonly value: T;
  readonly storedAtMs: number;
  readonly ttlMs: number;
  readonly staleTtlMs: number;
}

export interface CachePolicy {
  readonly ttlMs: number;
  readonly staleTtlMs: number;
}

/**
 * In-memory bounded cache supporting stale-while-revalidate and in-flight deduplication.
 */
export class SwrMemoryCache {
  private readonly entries = new Map<string, CacheRecord<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  /**
   * Creates a bounded cache instance with injectable clock for deterministic tests.
   */
  public constructor(options?: { maxEntries?: number; now?: () => number }) {
    this.maxEntries = options?.maxEntries ?? MAX_CACHE_ENTRIES;
    this.now = options?.now ?? (() => Date.now());
  }

  /**
   * Resolves a key from cache (fresh or stale-while-revalidate) or deduplicates concurrent fetches.
   */
  public async getOrFetch<T>(
    key: string,
    policy: CachePolicy,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    const existing = this.entries.get(key) as CacheRecord<T> | undefined;
    const currentTime = this.now();

    if (existing) {
      const ageMs = currentTime - existing.storedAtMs;
      if (ageMs <= existing.ttlMs) {
        return existing.value;
      }
      if (ageMs <= existing.staleTtlMs) {
        this.triggerBackgroundRevalidate(key, policy, fetcher, shouldCache);
        return existing.value;
      }
      this.entries.delete(key);
    }

    return this.runDeduplicatedFetch(key, policy, fetcher, shouldCache);
  }

  /**
   * Returns current number of cached keys (for diagnostics and tests).
   */
  public size(): number {
    return this.entries.size;
  }

  /**
   * Clears all cached entries and pending deduplication references.
   */
  public clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  private setEntry(key: string, value: unknown, policy: CachePolicy): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      storedAtMs: this.now(),
      ttlMs: policy.ttlMs,
      staleTtlMs: policy.staleTtlMs,
    });
  }

  private triggerBackgroundRevalidate<T>(
    key: string,
    policy: CachePolicy,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean,
  ): void {
    if (this.inFlight.has(key)) {
      return;
    }
    void this.runDeduplicatedFetch(key, policy, fetcher, shouldCache).catch((error: unknown) => {
      logger.warn("Background cache revalidation failed", {
        key,
        reason: error instanceof Error ? error.message : "unknown",
      });
    });
  }

  private async runDeduplicatedFetch<T>(
    key: string,
    policy: CachePolicy,
    fetcher: () => Promise<T>,
    shouldCache: (value: T) => boolean,
  ): Promise<T> {
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((value) => {
        if (shouldCache(value)) {
          this.setEntry(key, value, policy);
        }
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}

export const sharedServerCache = new SwrMemoryCache();
