// ============================================================================
// src/services/http.ts
// Guards outbound upstream fetches with SSRF checks, timeouts, and byte limits.
// ============================================================================

import type { z } from "zod";
import {
  DECIMAL_RADIX,
  HTTP_STATUS,
  MAX_UPSTREAM_RESPONSE_BYTES,
  UPSTREAM_DEFAULT_RETRY_AFTER_SECONDS,
  UPSTREAM_TIMEOUT_MS,
} from "@/lib/constants";
import { AppError, err, ok, safeJsonParse, type Result } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeResolveUpstreamUrl } from "@/services/security";
import type { FetchGuardOptions } from "@/types/api";

const oversizeError = () =>
  new AppError(
    "PAYLOAD_TOO_LARGE",
    "Upstream response exceeded maximum size limit.",
    HTTP_STATUS.BAD_GATEWAY,
  );

const upstreamError = (message: string, cause?: unknown) =>
  new AppError(
    "UPSTREAM_ERROR",
    message,
    HTTP_STATUS.BAD_GATEWAY,
    cause !== undefined ? { cause } : undefined,
  );

function buildRequestInit(
  options: FetchGuardOptions | undefined,
  signal: AbortSignal,
): RequestInit {
  return {
    method: options?.method ?? "GET",
    signal,
    ...(options?.headers ? { headers: options.headers } : {}),
    ...(options?.body !== undefined ? { body: options.body } : {}),
  };
}

function mapHttpStatusToError(response: Response): AppError | null {
  if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    const retryRaw = response.headers.get("retry-after");
    const parsed = retryRaw !== null ? Number.parseInt(retryRaw, DECIMAL_RADIX) : 0;
    const retryAfterSeconds =
      Number.isFinite(parsed) && parsed > 0 ? parsed : UPSTREAM_DEFAULT_RETRY_AFTER_SECONDS;
    return new AppError(
      "RATE_LIMITED",
      "Upstream service is temporarily rate limited.",
      HTTP_STATUS.TOO_MANY_REQUESTS,
      { retryAfterSeconds },
    );
  }
  return response.ok
    ? null
    : upstreamError(`Upstream data service returned status ${response.status}.`);
}

function parseAndValidateBody<T>(
  rawText: string,
  schema: z.ZodType<T>,
  hostname: string,
): Result<T> {
  const parsed = safeJsonParse(rawText);
  if (!parsed.ok)
    return err(upstreamError("Upstream service returned malformed JSON.", parsed.error));
  const validated = schema.safeParse(parsed.value);
  if (!validated.success) {
    logger.warn("Upstream schema mismatch", { host: hostname });
    return err(upstreamError("Upstream response did not match expected format."));
  }
  return ok(validated.data);
}

async function readStreamWithinLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let step = await reader.read();
  while (!step.done) {
    totalBytes += step.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw oversizeError();
    }
    chunks.push(step.value);
    step = await reader.read();
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declaredBytes = Number.parseInt(contentLengthHeader, DECIMAL_RADIX);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) throw oversizeError();
  }
  if (response.body) return readStreamWithinLimit(response.body, maxBytes);
  const fallbackText = await response.text();
  if (Buffer.byteLength(fallbackText, "utf8") > maxBytes) throw oversizeError();
  return fallbackText;
}

function createLinkedController(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Upstream request timed out"));
  }, timeoutMs);
  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };
  if (externalSignal) {
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    controller,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    },
  };
}

function mapFetchException(error: unknown, didTimeout: boolean): AppError {
  if (error instanceof AppError) return error;
  if (didTimeout)
    return new AppError(
      "UPSTREAM_TIMEOUT",
      "Upstream data service timed out.",
      HTTP_STATUS.GATEWAY_TIMEOUT,
    );
  return upstreamError("Unable to reach upstream data service.", error);
}

async function runGuardedFetch(
  targetUrl: string,
  options: FetchGuardOptions | undefined,
): Promise<Result<string>> {
  const linked = createLinkedController(options?.timeoutMs ?? UPSTREAM_TIMEOUT_MS, options?.signal);
  try {
    const response = await fetch(targetUrl, buildRequestInit(options, linked.controller.signal));
    const statusError = mapHttpStatusToError(response);
    if (statusError) return err(statusError);
    return ok(
      await readResponseTextWithLimit(response, options?.maxBytes ?? MAX_UPSTREAM_RESPONSE_BYTES),
    );
  } catch (error) {
    return err(mapFetchException(error, linked.didTimeout()));
  } finally {
    linked.cleanup();
  }
}

/** Fetches JSON from an allowlisted HTTPS endpoint with timeout, byte cap, and Zod validation. */
export async function fetchJsonWithGuard<T>(
  rawUrl: string,
  schema: z.ZodType<T>,
  options?: FetchGuardOptions,
): Promise<Result<T>> {
  const signal = options?.signal;
  if (signal?.aborted) return err(mapFetchException(signal.reason, false));
  const urlResult = safeResolveUpstreamUrl(rawUrl);
  if (!urlResult.ok) return urlResult;

  const textResult = await runGuardedFetch(urlResult.value.toString(), options);
  if (!textResult.ok) return textResult;
  return parseAndValidateBody(textResult.value, schema, urlResult.value.hostname);
}
