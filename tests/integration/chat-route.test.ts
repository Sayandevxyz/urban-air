// ============================================================================
// tests/integration/chat-route.test.ts
// Tests POST /api/chat LLM providers, fallback safety, validation, & quota.
// ============================================================================

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { POST as postChat } from "@/app/api/chat/route";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/services/container";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/*";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const JSON_HDR = { "Content-Type": "application/json" };
const DEFAULT_HDR = { ...JSON_HDR, "x-forwarded-for": "198.51.100.88" };

const mswServer = setupServer(
  http.post(GEMINI_URL, () =>
    HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [{ text: "<b>Stay indoors</b> in Delhi (US AQI 224, PM2.5 158 µg/m³)." }],
          },
        },
      ],
    }),
  ),
  http.post(ANTHROPIC_URL, () =>
    HttpResponse.json({
      content: [{ type: "text", text: "Anthropic grounded advice: Delhi US AQI is 224." }],
    }),
  ),
);

const VALID_BODY = {
  message: "How do I stay safe from winter smog?",
  locale: "en",
  profile: {
    persona: "general",
    commuteMode: "car",
    homeEnergyMode: "gas_biomass",
    filtrationMode: "none",
  },
  airQualityContext: {
    cityName: "Delhi",
    country: "India",
    source: "demo",
    updatedAtIso: "2026-11-26T08:00:00Z",
    usAqi: 224,
    europeanAqi: 108,
    readings: { pm25: 158, pm10: 278, no2: 92, o3: 38, so2: 24, co: 2450 },
  },
};

const makeReq = (body: unknown, headers: Record<string, string> = DEFAULT_HDR) =>
  new NextRequest("https://localhost:3000/api/chat", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const postJson = async (body = VALID_BODY) =>
  (await (await postChat(makeReq(body))).json()) as { engine: string; reply: string };

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "error" });
});
afterAll(() => {
  mswServer.close();
});
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.LLM_PROVIDER = "auto";
  process.env.TRUST_PROXY = "true";
  resetEnvCache();
  resetRateLimiter();
});
afterEach(() => {
  mswServer.resetHandlers();
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.DAILY_LLM_MAX_REQUESTS;
  process.env.LLM_PROVIDER = "auto";
  resetEnvCache();
});

test("POST /api/chat serves grounded fallback with zero API keys", async () => {
  const res = await postChat(makeReq(VALID_BODY));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ engine: "fallback", refused: false });
});

test("POST /api/chat calls Gemini, sanitizes tags/keys, and falls back on upstream errors", async () => {
  process.env.GEMINI_API_KEY = "test-gemini-secret-key-12345";
  resetEnvCache();

  const live = await postJson();
  expect(live.engine).toBe("gemini");
  expect(live.reply).not.toContain("<b>");

  mswServer.use(
    http.post(GEMINI_URL, () =>
      HttpResponse.json({
        candidates: [{ content: { parts: [{ text: "Leak test-gemini-secret-key-12345" }] } }],
      }),
    ),
  );
  expect((await postJson()).reply).toContain("[REDACTED]");

  mswServer.use(http.post(GEMINI_URL, () => HttpResponse.json({ candidates: [] })));
  expect((await postJson()).engine).toBe("fallback");

  mswServer.use(http.post(GEMINI_URL, () => HttpResponse.json({ error: "down" }, { status: 503 })));
  expect((await postJson()).engine).toBe("fallback");
});

test("POST /api/chat calls Anthropic when selected and falls back on non-text or 503 responses", async () => {
  process.env.ANTHROPIC_API_KEY = "test-anthropic-secret-key-12345";
  process.env.LLM_PROVIDER = "anthropic";
  resetEnvCache();

  expect((await postJson()).engine).toBe("anthropic");
  mswServer.use(
    http.post(ANTHROPIC_URL, () => HttpResponse.json({ content: [{ type: "tool_use" }] })),
  );
  expect((await postJson()).engine).toBe("fallback");
  mswServer.use(
    http.post(ANTHROPIC_URL, () => HttpResponse.json({ error: "down" }, { status: 503 })),
  );
  expect((await postJson()).engine).toBe("fallback");
});

test.each<[unknown, Record<string, string>, number]>([
  ["{broken", JSON_HDR, 400],
  [VALID_BODY, { ...JSON_HDR, "Content-Length": "abc" }, 400],
  [{}, { ...JSON_HDR, "Content-Length": "999999" }, 413],
  [VALID_BODY, { ...JSON_HDR, "Content-Length": "100" }, 200],
  [{ ...VALID_BODY, message: "z".repeat(17_000) }, JSON_HDR, 413],
  [{ ...VALID_BODY, message: "x".repeat(600) }, JSON_HDR, 400],
  ["x".repeat(17_000), JSON_HDR, 413],
  [VALID_BODY, { "Content-Type": "text/plain" }, 415],
  [VALID_BODY, {}, 415],
])(
  "POST /api/chat enforces HTTP status %s for edge headers/payloads",
  async (body, headers, expected) => {
    expect((await postChat(makeReq(body, headers))).status).toBe(expected);
  },
);

test("POST /api/chat enforces daily per-IP quota limit with 429 and Retry-After", async () => {
  process.env.DAILY_LLM_MAX_REQUESTS = "2";
  resetEnvCache();
  resetRateLimiter();
  const hdr = { ...JSON_HDR, "x-forwarded-for": "198.51.100.99" };

  expect((await postChat(makeReq(VALID_BODY, hdr))).status).toBe(200);
  expect((await postChat(makeReq(VALID_BODY, hdr))).status).toBe(200);
  const blocked = await postChat(makeReq(VALID_BODY, hdr));
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("Retry-After")).toBeTruthy();
  expect(blocked.headers.get("Cache-Control")).toBe("no-store");
});
