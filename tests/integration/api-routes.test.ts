import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getAirQuality } from "@/app/api/air-quality/route";
import { GET as getGeocode } from "@/app/api/geocode/route";
import { GET as getHealth } from "@/app/api/health/route";
import { resetEnvCache } from "@/lib/env";
import { sharedServerCache } from "@/services/cache";
import { resetRateLimiter } from "@/services/container";

const mswServer = setupServer(
  http.get("https://geocoding-api.open-meteo.com/v1/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("name") ?? "";
    if (q.toLowerCase() === "emptycity") {
      return HttpResponse.json({ results: [] });
    }
    return HttpResponse.json({
      results: [
        {
          id: 1,
          name: "Delhi",
          latitude: 28.6139,
          longitude: 77.209,
          country: "India",
          admin1: "Delhi",
          timezone: "Asia/Kolkata",
        },
      ],
    });
  }),
  http.get("https://air-quality-api.open-meteo.com/v1/air-quality", ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has("current")) {
      return HttpResponse.json({
        current: {
          time: "2026-11-26T08:00",
          us_aqi: 215,
          european_aqi: 102,
          pm2_5: 140,
          pm10: 250,
          nitrogen_dioxide: 88,
          ozone: 32,
          sulphur_dioxide: 20,
          carbon_monoxide: 2100,
        },
      });
    }
    return HttpResponse.json({
      hourly: {
        time: ["2026-11-26T08:00", "2026-11-26T14:00", "2026-11-27T08:00"],
        us_aqi: [215, 110, 195],
        european_aqi: [102, 58, 92],
        pm2_5: [140, 42, 120],
        pm10: [250, 88, 210],
        nitrogen_dioxide: [88, 35, 78],
        ozone: [32, 68, 30],
      },
    });
  }),
);

function buildRequest(path: string, ip = "198.51.100.1"): NextRequest {
  return new NextRequest(`https://localhost:3000${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

describe("integration: API routes with MSW", () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: "error" });
  });
  afterAll(() => {
    mswServer.close();
  });

  beforeEach(() => {
    sharedServerCache.clear();
    resetRateLimiter();
    resetEnvCache();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  it("GET /api/health reports liveness without leaking secrets", async () => {
    const res = getHealth();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; llmConfigured: boolean };
    expect(json.status).toBe("ok");
    expect(typeof json.llmConfigured).toBe("boolean");
  });

  it("GET /api/geocode handles live Open-Meteo success, empty results, demo mode, and invalid input", async () => {
    const live = await getGeocode(buildRequest("/api/geocode?q=Delhi"));
    expect(live.status).toBe(200);
    const liveData = (await live.json()) as { results: Array<{ name: string }> };
    expect(liveData.results[0]?.name).toBe("Delhi");

    const empty = await getGeocode(buildRequest("/api/geocode?q=EmptyCity"));
    expect(empty.status).toBe(200);
    const emptyData = (await empty.json()) as { results: unknown[] };
    expect(emptyData.results).toEqual([]);

    const demo = await getGeocode(buildRequest("/api/geocode?q=Coimbatore&demo=true"));
    expect(demo.status).toBe(200);
    const demoData = (await demo.json()) as { results: Array<{ key: string }>; source: string };
    expect(demoData.source).toBe("demo");
    expect(demoData.results[0]?.key).toBe("coimbatore");

    const bad = await getGeocode(buildRequest("/api/geocode?q=<script>alert(1)</script>"));
    expect(bad.status).toBe(400);
  });

  it("GET /api/air-quality returns parallel-fetched live report, demo report, and validates inputs", async () => {
    const live = await getAirQuality(buildRequest("/api/air-quality?cityKey=delhi"));
    expect(live.status).toBe(200);
    const liveData = (await live.json()) as {
      report: { current: { usAqi: number }; daily: unknown[] };
    };
    expect(liveData.report.current.usAqi).toBe(215);
    expect(liveData.report.daily).toHaveLength(2);

    const demo = await getAirQuality(buildRequest("/api/air-quality?cityKey=coimbatore&demo=true"));
    expect(demo.status).toBe(200);
    const demoData = (await demo.json()) as {
      report: { source: string; current: { usAqi: number } };
    };
    expect(demoData.report.source).toBe("demo");
    expect(demoData.report.current.usAqi).toBe(46);

    const badCoords = await getAirQuality(buildRequest("/api/air-quality?lat=120&lon=10"));
    expect(badCoords.status).toBe(400);

    const unknownCity = await getAirQuality(buildRequest("/api/air-quality?cityKey=atlantis"));
    expect(unknownCity.status).toBe(404);

    const missingParams = await getAirQuality(buildRequest("/api/air-quality"));
    expect(missingParams.status).toBe(400);

    const customCoords = await getAirQuality(buildRequest("/api/air-quality?lat=28.61&lon=77.21"));
    expect(customCoords.status).toBe(200);

    mswServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({
          results: [{ id: 9, name: "SparseTown", latitude: 10.1234, longitude: 20.5678 }],
        }),
      ),
      http.get("https://air-quality-api.open-meteo.com/v1/air-quality", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("current")) {
          return HttpResponse.json({
            current: { time: "2026-11-26T08:00", us_aqi: null, european_aqi: null, pm2_5: 12 },
          });
        }
        return HttpResponse.json({
          hourly: {
            time: [
              "2026-11-20T08:00",
              "2026-11-21T08:00",
              "2026-11-22T08:00",
              "2026-11-23T08:00",
              "2026-11-24T08:00",
              "2026-11-25T08:00",
              "2026-11-26T08:00",
              "2026-11-27T08:00",
            ],
            pm2_5: [12, 14, 16, 18, 20, 22, 24, 26],
          },
        });
      }),
    );
    const sparseGeo = await getGeocode(buildRequest("/api/geocode?q=SparseTown"));
    expect(sparseGeo.status).toBe(200);
    const sparseAq = await getAirQuality(buildRequest("/api/air-quality?lat=10.12&lon=20.57"));
    expect(sparseAq.status).toBe(200);

    mswServer.use(
      http.get("https://air-quality-api.open-meteo.com/v1/air-quality", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("current")) {
          return HttpResponse.json({ err: true }, { status: 503 });
        }
        return HttpResponse.json({ hourly: { time: [] } });
      }),
    );
    const aqFailCurrent = await getAirQuality(buildRequest("/api/air-quality?lat=11.11&lon=22.22"));
    expect(aqFailCurrent.status).toBe(502);

    mswServer.use(
      http.get("https://air-quality-api.open-meteo.com/v1/air-quality", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.has("current")) {
          return HttpResponse.json({ current: { time: "2026-11-26T08:00", pm2_5: 10 } });
        }
        return HttpResponse.json({ err: true }, { status: 503 });
      }),
    );
    const aqFailHourly = await getAirQuality(buildRequest("/api/air-quality?lat=12.12&lon=23.23"));
    expect(aqFailHourly.status).toBe(502);
  });

  it("maps upstream 5xx, 429, malformed JSON, and timeouts to safe error responses", async () => {
    mswServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ error: "fail" }, { status: 503 }),
      ),
    );
    const upstream5xx = await getGeocode(buildRequest("/api/geocode?q=Berlin"));
    expect(upstream5xx.status).toBe(502);

    mswServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.text("not-json", { status: 200 }),
      ),
    );
    const malformed = await getGeocode(buildRequest("/api/geocode?q=Paris"));
    expect(malformed.status).toBe(502);

    mswServer.use(
      http.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "45" } }),
      ),
    );
    const rateLimited = await getGeocode(buildRequest("/api/geocode?q=Tokyo"));
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get("Retry-After")).toBe("45");

    mswServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", async () => {
        await delay(9_000);
        return HttpResponse.json({ results: [] });
      }),
    );
    const prevTimeout = process.env.RATE_LIMIT_MAX_REQUESTS;
    const controller = new AbortController();
    const req = new NextRequest("https://localhost:3000/api/geocode?q=SlowCity", {
      headers: { "x-forwarded-for": "198.51.100.2" },
      signal: controller.signal,
    });
    setTimeout(() => {
      controller.abort();
    }, 50);
    const aborted = await getGeocode(req);
    expect(aborted.status).toBe(502);
    if (prevTimeout === undefined) delete process.env.RATE_LIMIT_MAX_REQUESTS;
    else process.env.RATE_LIMIT_MAX_REQUESTS = prevTimeout;
  });

  it("enforces per-IP rate limiting with 429 and Retry-After header", async () => {
    const prevMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    process.env.RATE_LIMIT_MAX_REQUESTS = "2";
    resetEnvCache();
    resetRateLimiter();

    const r1 = await getGeocode(buildRequest("/api/geocode?q=Delhi&demo=true", "203.0.113.55"));
    const r2 = await getGeocode(buildRequest("/api/geocode?q=Mumbai&demo=true", "203.0.113.55"));
    const r3 = await getGeocode(buildRequest("/api/geocode?q=London&demo=true", "203.0.113.55"));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers.get("Retry-After")).toBeTruthy();

    if (prevMax === undefined) delete process.env.RATE_LIMIT_MAX_REQUESTS;
    else process.env.RATE_LIMIT_MAX_REQUESTS = prevMax;
    resetEnvCache();
    resetRateLimiter();
  });
});
