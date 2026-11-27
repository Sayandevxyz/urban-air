import { DEFAULT_RETRY_AFTER_SECONDS } from "@/lib/constants";
import { safeJsonParse } from "@/lib/errors";
import type { ApiFetchResult, ApiRequestOptions } from "@/types/api";

interface ApiErrorShape {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly retryAfterSeconds?: number;
  };
}

function extractRetryAfterSeconds(body: unknown): number {
  if (typeof body !== "object" || body === null) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }
  const value = (body as ApiErrorShape).error?.retryAfterSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_RETRY_AFTER_SECONDS;
}

function buildClientRequestInit(options?: ApiRequestOptions): RequestInit {
  const init: RequestInit = { method: options?.method ?? "GET" };
  if (options?.headers) init.headers = options.headers;
  if (options?.body !== undefined) init.body = options.body;
  if (options?.signal) init.signal = options.signal;
  return init;
}

function mapResponseResult<T>(response: Response, rawText: string): ApiFetchResult<T> {
  const parsed = safeJsonParse(rawText);
  const body = parsed.ok ? parsed.value : undefined;
  if (response.status === 429) {
    return { ok: false, kind: "rate_limited", retryAfterSeconds: extractRetryAfterSeconds(body) };
  }
  if (!response.ok || body === undefined) {
    return { ok: false, kind: "error", status: response.status };
  }
  return { ok: true, data: body as T };
}

/**
 * Shared client fetch helper with safe JSON parsing, AbortError detection, and 429 retry-after extraction.
 */
export async function fetchApiJson<T>(
  url: string,
  options?: ApiRequestOptions,
): Promise<ApiFetchResult<T>> {
  try {
    const response = await fetch(url, buildClientRequestInit(options));
    const rawText = await response.text();
    return mapResponseResult<T>(response, rawText);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, kind: "aborted" };
    }
    return { ok: false, kind: "error", status: 0 };
  }
}
