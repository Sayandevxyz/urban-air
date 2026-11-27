// ============================================================================
// tests/unit/lib-core.test.ts
// Tests Result/AppError helpers, log redaction, Zod env parsing, and i18n parity.
// ============================================================================

import { expect, test, vi } from "vitest";
import { loadLocaleMessages } from "@/components/LocaleContext";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import ta from "@/i18n/ta.json";
import {
  fetchAirQuality,
  fetchApiJson,
  parseGeocodePayload,
  readCachedSnapshot,
} from "@/lib/api-client";
import { getEnv, parseEnv, resetEnvCache } from "@/lib/env";
import { AppError, err, ok, safeJsonParse, toSafeErrorResponse } from "@/lib/errors";
import { logger, redactCoordinate, sanitizeLogContext } from "@/lib/logger";
import { getDemoAirQualityReport, getDemoCityLocations } from "@/services/demo-data";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isRecord(v)) keys.push(...collectKeys(v, path));
    else {
      keys.push(path);
      expect(typeof v).toBe("string");
      expect(String(v).trim().length).toBeGreaterThan(0);
    }
  }
  return keys.sort();
}

test("AppError, Result, safeJsonParse, and error payload masking behave consistently", () => {
  const success = ok(42);
  const failure = err(new AppError("VALIDATION_ERROR", "Invalid city", 400));
  expect(success).toEqual({ ok: true, value: 42 });
  expect(failure.ok).toBe(false);
  if (!failure.ok) expect(failure.error.code).toBe("VALIDATION_ERROR");

  const rateErr = toSafeErrorResponse(
    new AppError("RATE_LIMITED", "Slow down", 429, { retryAfterSeconds: 30 }),
  );
  expect(rateErr).toEqual({
    statusCode: 429,
    body: { error: { code: "RATE_LIMITED", message: "Slow down", retryAfterSeconds: 30 } },
  });

  const masked = toSafeErrorResponse(new Error("SECRET_DB_DSN=postgres://user:pass@host"));
  expect(masked.statusCode).toBe(500);
  expect(JSON.stringify(masked.body)).not.toContain("SECRET_DB_DSN");
  expect(safeJsonParse('{"aqi":42}')).toEqual({ ok: true, value: { aqi: 42 } });
  expect(safeJsonParse("{invalid").ok).toBe(false);
  expect(safeJsonParse("").ok).toBe(false);
});

test("logger redacts secrets and coordinates and respects LOG_LEVEL routing", () => {
  expect(redactCoordinate(28.613939)).toBe(28.61);
  expect(redactCoordinate(-0.127758)).toBe(-0.13);
  expect(sanitizeLogContext(undefined)).toBeUndefined();
  const clean = sanitizeLogContext({
    apiKey: "secret",
    latitude: 28.6139,
    lon: 77.209,
    city: "Delhi",
    longText: "a".repeat(350),
  });
  expect(clean?.apiKey).toBe("[REDACTED]");
  expect(clean?.latitude).toBe(28.61);
  expect(clean?.lon).toBe(77.21);
  expect(String(clean?.longText)).toContain("...[truncated]");

  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const prev = process.env.LOG_LEVEL;
  const prevEnv = process.env.NODE_ENV;
  process.env.LOG_LEVEL = "silent";
  logger.info("hidden");
  expect(stdoutSpy).not.toHaveBeenCalled();

  process.env.LOG_LEVEL = "info";
  logger.info("visible", { lat: 11.0168 });
  expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("11.02");

  delete process.env.LOG_LEVEL;
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  logger.info("prod-default-info");
  expect(stdoutSpy).toHaveBeenCalledTimes(2);
  (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
  if (prev === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = prev;
  stdoutSpy.mockRestore();
});

test("parseEnv defaults cleanly, rejects SSRF/HTTP/NEXT_PUBLIC secrets, and memoizes getEnv", () => {
  const def = parseEnv({ NODE_ENV: "test", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "" });
  expect(def.LLM_PROVIDER).toBe("auto");
  expect(def.GEMINI_API_KEY).toBeUndefined();
  expect(def.RATE_LIMIT_MAX_REQUESTS).toBe(60);

  expect(() =>
    parseEnv({ OPEN_METEO_AIR_QUALITY_BASE_URL: "https://evil.example.com/v1" }),
  ).toThrow(AppError);
  expect(() =>
    parseEnv({ OPEN_METEO_GEOCODING_BASE_URL: "http://geocoding-api.open-meteo.com/v1" }),
  ).toThrow(AppError);
  expect(() => parseEnv({ OPEN_METEO_AIR_QUALITY_BASE_URL: "not-a-valid-url" })).toThrow(AppError);
  expect(() => parseEnv({ NEXT_PUBLIC_GEMINI_API_KEY: "super-secret-value-1234" })).toThrow(
    AppError,
  );

  resetEnvCache();
  expect(getEnv()).toBe(getEnv());
  resetEnvCache();
});

test("i18n catalogs maintain full key parity and dynamically load all locales", async () => {
  const enKeys = collectKeys(en);
  expect(collectKeys(hi)).toEqual(enKeys);
  expect(collectKeys(ta)).toEqual(enKeys);
  expect((await loadLocaleMessages("en")).app.title).toBe(en.app.title);
  expect((await loadLocaleMessages("hi")).app.title).toBe(hi.app.title);
  expect((await loadLocaleMessages("ta")).app.title).toBe(ta.app.title);
});

const jsonRes = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

const stubFetch = (fn: () => Promise<Response>) => {
  vi.stubGlobal("fetch", vi.fn(fn));
};

test("fetchApiJson and parseGeocodePayload validate responses and handle aborts and 429s", async () => {
  stubFetch(() => Promise.reject(new DOMException("aborted", "AbortError")));
  expect((await fetchApiJson("/api/health", parseGeocodePayload)).ok).toBe(false);
  stubFetch(() => Promise.reject(new Error("offline")));
  expect((await fetchApiJson("/api/health", parseGeocodePayload)).ok).toBe(false);
  for (const [body, sec] of [
    ["str", 30],
    [{ error: { retryAfterSeconds: 12 } }, 12],
    [{ error: { retryAfterSeconds: -1 } }, 30],
  ] as const) {
    stubFetch(() => jsonRes(body, 429));
    expect(await fetchApiJson("/api/geocode", parseGeocodePayload)).toEqual({
      ok: false,
      kind: "rate_limited",
      retryAfterSeconds: sec,
    });
  }
  const loc = getDemoCityLocations()[0];
  expect(parseGeocodePayload({})).toEqual({});
  for (const b of [null, [], { results: "bad" }]) expect(parseGeocodePayload(b)).toBeNull();
  if (loc) {
    expect(parseGeocodePayload({ results: [{ ...loc, key: 1 }] })).toBeNull();
    expect(parseGeocodePayload({ results: [{ ...loc, latitude: Number.NaN }] })).toBeNull();
    expect(parseGeocodePayload({ results: [loc] })).toEqual({ results: [loc] });
  }
  vi.restoreAllMocks();
});

test("fetchAirQuality and readCachedSnapshot validate reports and handle storage fallbacks", async () => {
  const loc = getDemoCityLocations()[0];
  if (loc) {
    expect((await fetchAirQuality(loc, true)).ok).toBe(true);
    for (const [payload, status] of [
      ["bad", 200],
      [{ report: "bad" }, 200],
      [{}, 502],
    ] as const) {
      stubFetch(() => jsonRes(payload));
      expect(await fetchAirQuality(loc, false)).toEqual({ ok: false, kind: "error", status });
    }
    const geoLoc = { ...loc, key: "geo-self-current" };
    stubFetch(() => jsonRes({ report: { ...getDemoAirQualityReport("delhi"), location: geoLoc } }));
    expect((await fetchAirQuality(geoLoc, false)).ok).toBe(true);
    expect(window.localStorage.getItem("urban-air:last-snapshot:v1")).toBeNull();
    stubFetch(() => jsonRes({ report: getDemoAirQualityReport("delhi") }));
    expect((await fetchAirQuality({ ...loc, key: "loc-2861-7721" }, false)).ok).toBe(true);
    expect(readCachedSnapshot()?.source).toBe("cached");
  }
  for (const val of ["{bad", JSON.stringify({ source: "x" })]) {
    window.localStorage.setItem("urban-air:last-snapshot:v1", val);
    expect(readCachedSnapshot()).toBeNull();
  }
  vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => {
    throw new Error("blocked");
  });
  expect(readCachedSnapshot()).toBeNull();
  vi.restoreAllMocks();
  window.localStorage.clear();
});
