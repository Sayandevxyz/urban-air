import { describe, expect, it, vi } from "vitest";
import { SwrMemoryCache } from "@/services/cache";

describe("SwrMemoryCache", () => {
  it("returns cached values within TTL and deduplicates concurrent misses", async () => {
    let now = 1_000;
    const cache = new SwrMemoryCache({ maxEntries: 5, now: () => now });
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return { value: "fresh-data" };
    });

    const [a, b] = await Promise.all([
      cache.getOrFetch("k1", { ttlMs: 10_000, staleTtlMs: 30_000 }, fetcher),
      cache.getOrFetch("k1", { ttlMs: 10_000, staleTtlMs: 30_000 }, fetcher),
    ]);

    expect(a).toEqual({ value: "fresh-data" });
    expect(b).toEqual({ value: "fresh-data" });
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 5_000;
    const c = await cache.getOrFetch("k1", { ttlMs: 10_000, staleTtlMs: 30_000 }, fetcher);
    expect(c).toEqual({ value: "fresh-data" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serves stale data immediately while revalidating in background", async () => {
    let now = 1_000;
    let version = 1;
    const cache = new SwrMemoryCache({ maxEntries: 5, now: () => now });
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return `v${version}`;
    });

    const first = await cache.getOrFetch("k1", { ttlMs: 10_000, staleTtlMs: 30_000 }, fetcher);
    expect(first).toBe("v1");

    now = 15_000;
    version = 2;
    const staleResult = await cache.getOrFetch(
      "k1",
      { ttlMs: 10_000, staleTtlMs: 30_000 },
      fetcher,
    );
    expect(staleResult).toBe("v1");

    await vi.waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    const updated = await cache.getOrFetch("k1", { ttlMs: 10_000, staleTtlMs: 30_000 }, fetcher);
    expect(updated).toBe("v2");
  });

  it("evicts oldest entry at max capacity and skips caching when shouldCache returns false", async () => {
    let now = 1_000;
    const cache = new SwrMemoryCache({ maxEntries: 2, now: () => now });
    const policy = { ttlMs: 10_000, staleTtlMs: 20_000 };

    await cache.getOrFetch("a", policy, () => Promise.resolve("A"));
    await cache.getOrFetch("b", policy, () => Promise.resolve("B"));
    await cache.getOrFetch("c", policy, () => Promise.resolve("C"));
    expect(cache.size()).toBe(2);

    const errFetcher = vi.fn(() => Promise.resolve({ ok: false }));
    await cache.getOrFetch("err", policy, errFetcher, (val) => val.ok);
    await cache.getOrFetch("err", policy, errFetcher, (val) => val.ok);
    expect(errFetcher).toHaveBeenCalledTimes(2);

    now += 25_000;
    await cache.getOrFetch("b", policy, () => Promise.resolve("B2"));
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
