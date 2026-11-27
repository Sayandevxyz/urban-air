import { describe, expect, it } from "vitest";
import { AppError, err, ok, safeJsonParse, toSafeErrorResponse } from "@/lib/errors";

describe("AppError and Result utilities", () => {
  it("wraps success and failure Results cleanly", () => {
    const success = ok(42);
    const failure = err(new AppError("VALIDATION_ERROR", "Invalid city", 400));
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.value).toBe(42);
    }
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("converts AppError including optional retryAfterSeconds into safe payload", () => {
    const response = toSafeErrorResponse(
      new AppError("RATE_LIMITED", "Too many requests", 429, { retryAfterSeconds: 30 }),
    );
    expect(response.statusCode).toBe(429);
    expect(response.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests",
        retryAfterSeconds: 30,
      },
    });
  });

  it("masks unknown errors without leaking stack traces", () => {
    const response = toSafeErrorResponse(new Error("SECRET_DB_DSN=postgres://user:pass@host"));
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("SECRET_DB_DSN");
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("safeJsonParse returns Result without throwing on malformed JSON", () => {
    const valid = safeJsonParse('{"aqi":42}');
    expect(valid).toEqual({ ok: true, value: { aqi: 42 } });

    const broken = safeJsonParse("{invalid");
    expect(broken.ok).toBe(false);

    const empty = safeJsonParse("");
    expect(empty.ok).toBe(false);
  });
});
