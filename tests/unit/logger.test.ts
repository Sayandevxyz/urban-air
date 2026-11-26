import { describe, expect, it, vi } from "vitest";
import { logger, redactCoordinate, sanitizeLogContext } from "@/lib/logger";

describe("logger and privacy redaction", () => {
  it("truncates coordinates to 2 decimal places", () => {
    expect(redactCoordinate(28.613939)).toBe(28.61);
    expect(redactCoordinate(-0.127758)).toBe(-0.13);
  });

  it("redacts sensitive keys and coordinates in structured log context", () => {
    expect(sanitizeLogContext(undefined)).toBeUndefined();
    const sanitized = sanitizeLogContext({
      apiKey: "secret-abc",
      latitude: 28.613939,
      lon: 77.209021,
      city: "Delhi",
      longText: "a".repeat(350),
    });

    expect(sanitized).toBeDefined();
    expect(sanitized?.apiKey).toBe("[REDACTED]");
    expect(sanitized?.latitude).toBe(28.61);
    expect(sanitized?.lon).toBe(77.21);
    expect(sanitized?.city).toBe("Delhi");
    expect(String(sanitized?.longText)).toContain("...[truncated]");
  });

  it("suppresses output when LOG_LEVEL is silent and writes JSON when info", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "silent";
    logger.info("hidden");
    expect(stdoutSpy).not.toHaveBeenCalled();

    process.env.LOG_LEVEL = "info";
    logger.info("visible", { lat: 11.0168 });
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(String(stdoutSpy.mock.calls[0]?.[0])).toContain("11.02");

    delete process.env.LOG_LEVEL;
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    logger.info("prod-default-info");
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;

    if (prev === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = prev;
    }
    stdoutSpy.mockRestore();
  });
});
