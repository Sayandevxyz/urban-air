// ============================================================================
// tests/integration/api-routes.test.ts
// Tests /api/health, /api/geocode, and /api/air-quality with MSW mocks.
// ============================================================================

import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { GET as getAirQuality } from "@/app/api/air-quality/route";
import { GET as getGeocode } from "@/app/api/geocode/route";
import { GET as getHealth } from "@/app/api/health/route";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/services/container";
import { clearOpenMeteoCaches } from "@/services/open-meteo";

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DELHI_GEO = {
  id: 1,
  name: "Delhi",
  latitude: 28.6139,
  longitude: 77.209,
  country: "India",
  admin1: "Delhi",
  timezone: "Asia/Kolkata",
};
const CUR_BODY = {
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
};
const HR_BODY = {
  hourly: {
    time: ["2026-11-26T08:00", "2026-11-26T14:00", "2026-11-27T08:00"],
    us_aqi: [215, 110, 195],
    european_aqi: [102, 58, 92],
    pm2_5: [140, 42, 120],
    pm10: [250, 88, 210],
    nitrogen_dioxide: [88, 35, 78],
    ozone: [32, 68, 30],
  },
};

const mswServer = setupServer(
  http.get(GEO_URL, ({ request }) => {
    const q = (new URL(request.url).searchParams.get("name") ?? "").toLowerCase();
    return HttpResponse.json({ results: q === "emptycity" ? [] : [DELHI_GEO] });
  }),
  http.get(AQ_URL, ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.has("current") ? CUR_BODY : HR_BODY),
  ),
);

const buildReq = (path: string, ip = "198.51.100.1") =>
  new NextRequest(`https://localhost:3000${path}`, { headers: { "x-forwarded-for": ip } });
const jsonOf = async <T>(res: Response) => (await res.json()) as T;
const prevTrustProxy = process.env.TRUST_PROXY;

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "error" });
});
afterAll(() => {
  mswServer.close();
});
beforeEach(() => {
  process.env.TRUST_PROXY = "true";
  clearOpenMeteoCaches();
  resetRateLimiter();
  resetEnvCache();
});
afterEach(() => {
  mswServer.resetHandlers();
  if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = prevTrustProxy;
  resetEnvCache();
});

const reqGeo = (q: string, ip?: string) => getGeocode(buildReq(`/api/geocode?q=${q}`, ip));
const reqAq = (qs: string) =>
  getAirQuality(buildReq(qs ? `/api/air-quality?${qs}` : "/api/air-quality"));

test("GET /api/health and /api/geocode serve live, empty, demo, and reject bad queries", async () => {
  const health = getHealth();
  expect(health.status).toBe(200);
  expect(typeof (await jsonOf<{ llmConfigured: boolean }>(health)).llmConfigured).toBe("boolean");

  const live = await reqGeo("Delhi");
  expect([live.status, live.headers.get("Cache-Control")]).toEqual([200, "no-store"]);
  expect((await jsonOf<{ results: Array<{ name: string }> }>(live)).results[0]?.name).toBe("Delhi");

  const empty = await jsonOf<{ results: unknown[] }>(await reqGeo("EmptyCity"));
  expect(empty.results).toEqual([]);
  const demo = await jsonOf<{ source: string }>(await reqGeo("Coimbatore&demo=true"));
  expect(demo.source).toBe("demo");
  expect((await reqGeo("<script>alert(1)</script>")).status).toBe(400);
});

test("GET /api/air-quality returns parallel telemetry, demo reports, and validates inputs", async () => {
  const live = await reqAq("cityKey=delhi");
  expect(live.status).toBe(200);
  expect(
    (await jsonOf<{ report: { current: { usAqi: number } } }>(live)).report.current.usAqi,
  ).toBe(215);

  const demo = await jsonOf<{ report: { source: string; current: { usAqi: number } } }>(
    await reqAq("cityKey=coimbatore&demo=true"),
  );
  expect(demo.report).toMatchObject({ source: "demo", current: { usAqi: 46 } });
  const statuses = await Promise.all([
    reqAq("lat=120&lon=10").then((r) => r.status),
    reqAq("cityKey=atlantis").then((r) => r.status),
    reqAq("").then((r) => r.status),
    reqAq("lat=28.61&lon=77.21").then((r) => r.status),
  ]);
  expect(statuses).toEqual([400, 404, 400, 200]);
});

type JsonObj = Record<string, unknown>;
const mockAq = (cur: JsonObj, hr: JsonObj, codes: readonly [number, number] = [200, 200]) =>
  http.get(AQ_URL, ({ request }) => {
    const isCur = new URL(request.url).searchParams.has("current");
    return HttpResponse.json(isCur ? cur : hr, { status: isCur ? codes[0] : codes[1] });
  });

test("GET /api/air-quality handles sparse upstream data and partial parallel upstream errors", async () => {
  const sparseGeo = { id: 9, name: "Sparse", latitude: 10.1234, longitude: 20.5678 };
  const sparseCur = {
    current: { time: "2026-11-26T08:00", us_aqi: null, european_aqi: null, pm2_5: 12 },
  };
  const sparseHr = { hourly: { time: ["2026-11-20T08:00", "2026-11-21T08:00"], pm2_5: [12, 14] } };
  mswServer.use(
    http.get(GEO_URL, () => HttpResponse.json({ results: [sparseGeo] })),
    mockAq(sparseCur, sparseHr),
  );
  expect((await reqGeo("Sparse")).status).toBe(200);
  expect((await reqAq("lat=10.12&lon=20.57")).status).toBe(200);

  mswServer.use(mockAq({ err: true }, { hourly: { time: [] } }, [503, 200]));
  expect((await reqAq("lat=11.11&lon=22.22")).status).toBe(502);

  mswServer.use(
    mockAq({ current: { time: "2026-11-26T08:00", pm2_5: 10 } }, { err: true }, [200, 503]),
  );
  expect((await reqAq("lat=12.12&lon=23.23")).status).toBe(502);
});

test("API routes map upstream 5xx, malformed JSON, 429, and client aborts safely", async () => {
  mswServer.use(http.get(GEO_URL, () => HttpResponse.json({ error: "fail" }, { status: 503 })));
  expect((await reqGeo("Berlin")).status).toBe(502);

  mswServer.use(http.get(GEO_URL, () => HttpResponse.text("not-json", { status: 200 })));
  expect((await reqGeo("Paris")).status).toBe(502);

  const res429 = new HttpResponse(null, { status: 429, headers: { "Retry-After": "45" } });
  mswServer.use(http.get(GEO_URL, () => res429));
  const r429 = await reqGeo("Tokyo");
  expect([r429.status, r429.headers.get("Retry-After")]).toEqual([429, "45"]);

  mswServer.use(
    http.get(GEO_URL, async () => {
      await delay(9_000);
      return HttpResponse.json({ results: [] });
    }),
  );
  const ctrl = new AbortController();
  setTimeout(() => {
    ctrl.abort();
  }, 50);
  const slowReq = new NextRequest("https://localhost:3000/api/geocode?q=Slow", {
    headers: { "x-forwarded-for": "198.51.100.2" },
    signal: ctrl.signal,
  });
  expect((await getGeocode(slowReq)).status).toBe(502);
});

test("API routes enforce per-IP rate limiting with 429 and Retry-After header", async () => {
  process.env.RATE_LIMIT_MAX_REQUESTS = "2";
  resetEnvCache();
  resetRateLimiter();
  const r1 = await reqGeo("Delhi&demo=true", "203.0.113.55");
  const r2 = await reqGeo("Mumbai&demo=true", "203.0.113.55");
  const blocked = await reqGeo("London&demo=true", "203.0.113.55");
  expect([r1.status, r2.status, blocked.status]).toEqual([200, 200, 429]);
  expect(blocked.headers.get("Retry-After")).toBeTruthy();
  delete process.env.RATE_LIMIT_MAX_REQUESTS;
});
