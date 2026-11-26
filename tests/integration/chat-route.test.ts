import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as postChat } from "@/app/api/chat/route";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimiter } from "@/services/container";

const mswServer = setupServer(
  http.post("https://generativelanguage.googleapis.com/v1beta/models/*", () =>
    HttpResponse.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: "<b>Stay indoors</b> in Delhi (US AQI 224, PM2.5 158 µg/m³). Use N95 and metro transit.",
              },
            ],
          },
        },
      ],
    }),
  ),
  http.post("https://api.anthropic.com/v1/messages", () =>
    HttpResponse.json({
      content: [
        {
          type: "text",
          text: "Anthropic grounded advice: Delhi US AQI is 224. Keep windows sealed.",
        },
      ],
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

function makeChatReq(body: unknown, ip = "198.51.100.88"): NextRequest {
  return new NextRequest("https://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("integration: POST /api/chat", () => {
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevAnthropic = process.env.ANTHROPIC_API_KEY;
  const prevProvider = process.env.LLM_PROVIDER;
  const prevDailyMax = process.env.DAILY_LLM_MAX_REQUESTS;
  const prevTrustProxy = process.env.TRUST_PROXY;

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
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropic;
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = prevProvider;
    if (prevDailyMax === undefined) delete process.env.DAILY_LLM_MAX_REQUESTS;
    else process.env.DAILY_LLM_MAX_REQUESTS = prevDailyMax;
    if (prevTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prevTrustProxy;
    resetEnvCache();
  });

  it("works with zero API keys via deterministic fallback", async () => {
    const res = await postChat(makeChatReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { engine: string; reply: string; refused: boolean };
    expect(json.engine).toBe("fallback");
    expect(json.refused).toBe(false);
    expect(json.reply).toContain("224");
  });

  it("calls Gemini when configured, strips HTML tags, and falls back on upstream error", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-secret-key-12345";
    resetEnvCache();

    const liveRes = await postChat(makeChatReq(VALID_BODY));
    expect(liveRes.status).toBe(200);
    const liveJson = (await liveRes.json()) as { engine: string; reply: string };
    expect(liveJson.engine).toBe("gemini");
    expect(liveJson.reply).not.toContain("<b>");
    expect(liveJson.reply).toContain("Stay indoors");

    mswServer.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/*", () =>
        HttpResponse.json({
          candidates: [
            {
              content: {
                parts: [{ text: "Secret leak test-gemini-secret-key-12345" }],
              },
            },
          ],
        }),
      ),
    );
    const redactedRes = await postChat(makeChatReq(VALID_BODY));
    const redactedJson = (await redactedRes.json()) as { reply: string };
    expect(redactedJson.reply).not.toContain("test-gemini-secret-key-12345");
    expect(redactedJson.reply).toContain("[REDACTED]");

    mswServer.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/*", () =>
        HttpResponse.json({ candidates: [] }),
      ),
    );
    const emptyCandRes = await postChat(makeChatReq(VALID_BODY));
    expect(((await emptyCandRes.json()) as { engine: string }).engine).toBe("fallback");

    mswServer.use(
      http.post("https://generativelanguage.googleapis.com/v1beta/models/*", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 503 }),
      ),
    );
    const fallbackRes = await postChat(makeChatReq(VALID_BODY));
    expect(fallbackRes.status).toBe(200);
    const fallbackJson = (await fallbackRes.json()) as { engine: string };
    expect(fallbackJson.engine).toBe("fallback");
  });

  it("calls Anthropic when configured and handles upstream error, invalid JSON, and oversized payloads", async () => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-secret-key-12345";
    process.env.LLM_PROVIDER = "anthropic";
    resetEnvCache();

    const res = await postChat(makeChatReq(VALID_BODY));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { engine: string; reply: string };
    expect(json.engine).toBe("anthropic");
    expect(json.reply).toContain("224");

    mswServer.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({ content: [{ type: "tool_use" }] }),
      ),
    );
    const antEmptyBlock = await postChat(makeChatReq(VALID_BODY));
    expect(((await antEmptyBlock.json()) as { engine: string }).engine).toBe("fallback");

    mswServer.use(
      http.post("https://api.anthropic.com/v1/messages", () =>
        HttpResponse.json({ error: "down" }, { status: 503 }),
      ),
    );
    const antFallback = await postChat(makeChatReq(VALID_BODY));
    expect(((await antFallback.json()) as { engine: string }).engine).toBe("fallback");

    const badJson = await postChat(makeChatReq("{broken"));
    expect(badJson.status).toBe(400);

    const badContentLen = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "abc" },
      body: JSON.stringify(VALID_BODY),
    });
    expect((await postChat(badContentLen)).status).toBe(400);

    const declaredTooLarge = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "999999" },
      body: "{}",
    });
    expect((await postChat(declaredTooLarge)).status).toBe(413);

    const declaredSmallOkLen = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "100" },
      body: JSON.stringify(VALID_BODY),
    });
    expect((await postChat(declaredSmallOkLen)).status).toBe(200);

    const oversizedWithoutLength = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_BODY, message: "z".repeat(17_000) }),
    });
    expect((await postChat(oversizedWithoutLength)).status).toBe(413);

    const oversized = await postChat(makeChatReq({ ...VALID_BODY, message: "x".repeat(600) }));
    expect(oversized.status).toBe(400);

    const tooLargeBody = await postChat(makeChatReq("x".repeat(17_000)));
    expect(tooLargeBody.status).toBe(413);

    const wrongMimeReq = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(VALID_BODY),
    });
    expect((await postChat(wrongMimeReq)).status).toBe(415);

    const missingMimeReq = new NextRequest("https://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify(VALID_BODY),
    });
    expect((await postChat(missingMimeReq)).status).toBe(415);
  });

  it("enforces daily per-IP quota limit with 429 and Retry-After header", async () => {
    process.env.DAILY_LLM_MAX_REQUESTS = "2";
    resetEnvCache();
    resetRateLimiter();

    expect((await postChat(makeChatReq(VALID_BODY, "198.51.100.99"))).status).toBe(200);
    expect((await postChat(makeChatReq(VALID_BODY, "198.51.100.99"))).status).toBe(200);
    const blocked = await postChat(makeChatReq(VALID_BODY, "198.51.100.99"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
  });
});
