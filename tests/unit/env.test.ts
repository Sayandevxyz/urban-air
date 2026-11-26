import { describe, expect, it } from "vitest";
import { getEnv, parseEnv, resetEnvCache } from "@/lib/env";
import { AppError } from "@/lib/errors";

describe("env validation", () => {
  it("parses valid defaults with zero API keys", () => {
    const env = parseEnv({ NODE_ENV: "test" });
    expect(env.NODE_ENV).toBe("test");
    expect(env.LLM_PROVIDER).toBe("auto");
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(60);
  });

  it("treats empty string API keys as undefined", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("rejects non-allowlisted upstream URLs to prevent SSRF misconfiguration", () => {
    expect(() =>
      parseEnv({
        OPEN_METEO_AIR_QUALITY_BASE_URL: "https://evil.example.com/v1",
      }),
    ).toThrow(AppError);
  });

  it("rejects HTTP (non-HTTPS) and malformed upstream URLs", () => {
    expect(() =>
      parseEnv({
        OPEN_METEO_GEOCODING_BASE_URL: "http://geocoding-api.open-meteo.com/v1",
      }),
    ).toThrow(AppError);
    expect(() =>
      parseEnv({
        OPEN_METEO_AIR_QUALITY_BASE_URL: "not-a-valid-url",
      }),
    ).toThrow(AppError);
  });

  it("rejects secrets placed under NEXT_PUBLIC_ prefix", () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_GEMINI_API_KEY: "super-secret-value-1234",
      }),
    ).toThrow(AppError);
  });

  it("memoizes and resets environment cache cleanly", () => {
    resetEnvCache();
    const first = getEnv();
    const second = getEnv();
    expect(first).toBe(second);
    resetEnvCache();
  });
});
