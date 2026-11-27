// ============================================================================
// src/lib/logger.ts
// Provides structured JSON logging with automatic secret and coord redaction.
// ============================================================================

import { COORDINATE_LOG_DECIMALS, DECIMAL_RADIX } from "@/lib/constants";

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const MAX_LOG_STRING_LENGTH = 300;
const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SENSITIVE_KEY_PATTERN = /key|token|secret|password|authorization|cookie/i;
const COORDINATE_KEY_PATTERN = /^(lat|lon|latitude|longitude)$/i;

/** Rounds coordinates to two decimal places (~1.1 km) to protect privacy in logs. */
export function redactCoordinate(value: number): number {
  const factor = DECIMAL_RADIX ** COORDINATE_LOG_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** Sanitizes log metadata by masking secret keys and truncating geographic coordinates. */
export function sanitizeLogContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(context)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (
      COORDINATE_KEY_PATTERN.test(key) &&
      typeof rawValue === "number" &&
      Number.isFinite(rawValue)
    ) {
      sanitized[key] = redactCoordinate(rawValue);
      continue;
    }

    if (typeof rawValue === "string" && rawValue.length > MAX_LOG_STRING_LENGTH) {
      sanitized[key] = `${rawValue.slice(0, MAX_LOG_STRING_LENGTH)}...[truncated]`;
      continue;
    }

    sanitized[key] = rawValue;
  }

  return sanitized;
}

function resolveLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error" || raw === "silent") {
    return raw;
  }
  if (process.env.NODE_ENV === "test") {
    return "silent";
  }
  return "info";
}

function writeLog(
  level: Exclude<LogLevel, "silent">,
  message: string,
  context?: Record<string, unknown>,
): void {
  const activeLevel = resolveLogLevel();
  if (LOG_PRIORITY[level] < LOG_PRIORITY[activeLevel]) {
    return;
  }

  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? { ctx: sanitizeLogContext(context) } : {}),
  };

  const line = `${JSON.stringify(entry)}\n`;
  if (level === "error" || level === "warn") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

/** Structured server logger replacing console.log across routes and service adapters. */
export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    writeLog("debug", message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    writeLog("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    writeLog("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    writeLog("error", message, context);
  },
};
