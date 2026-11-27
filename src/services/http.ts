import type { z } from "zod";
import {
  MAX_UPSTREAM_RESPONSE_BYTES,
  UPSTREAM_DEFAULT_RETRY_AFTER_SECONDS,
  UPSTREAM_TIMEOUT_MS,
} from "@/lib/constants";
import { AppError, err, ok, safeJsonParse, type Result } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeResolveUpstreamUrl } from "@/services/ssrf-guard";
import type { FetchGuardOptions } from "@/types/api";

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
  if (response.status === 429) {
    const retryRaw = response.headers.get("retry-after");
    const parsed = retryRaw !== null ? Number.parseInt(retryRaw, 10) : 0;
    const retryAfterSeconds =
      Number.isFinite(parsed) && parsed > 0 ? parsed : UPSTREAM_DEFAULT_RETRY_AFTER_SECONDS;
    return new AppError("RATE_LIMITED", "Upstream service is temporarily rate limited.", 429, {
      retryAfterSeconds,
    });
  }
  if (!response.ok) {
    return new AppError(
      "UPSTREAM_ERROR",
      `Upstream data service returned status ${response.status}.`,
      502,
    );
  }
  return null;
}

function parseAndValidateBody<T>(
  rawText: string,
  schema: z.ZodType<T>,
  hostname: string,
): Result<T> {
  const parsed = safeJsonParse(rawText);
  if (!parsed.ok) {
    return err(
      new AppError("UPSTREAM_ERROR", "Upstream service returned malformed JSON.", 502, {
        cause: parsed.error,
      }),
    );
  }
  const validated = schema.safeParse(parsed.value);
  if (!validated.success) {
    logger.warn("Upstream schema mismatch", { host: hostname });
    return err(
      new AppError("UPSTREAM_ERROR", "Upstream response did not match expected format.", 502),
    );
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
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Upstream response exceeded maximum size limit.",
        502,
      );
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
    const declaredBytes = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Upstream response exceeded maximum size limit.",
        502,
      );
    }
  }
  if (response.body) {
    return readStreamWithinLimit(response.body, maxBytes);
  }
  const fallbackText = await response.text();
  if (Buffer.byteLength(fallbackText, "utf8") > maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", "Upstream response exceeded maximum size limit.", 502);
  }
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
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
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
  if (didTimeout) {
    return new AppError("UPSTREAM_TIMEOUT", "Upstream data service timed out.", 504);
  }
  return new AppError("UPSTREAM_ERROR", "Unable to reach upstream data service.", 502, {
    cause: error,
  });
}

/**
 * Fetches JSON from an allowlisted HTTPS endpoint with timeout, byte cap, and Zod validation.
 */
export async function fetchJsonWithGuard<T>(
  rawUrl: string,
  schema: z.ZodType<T>,
  options?: FetchGuardOptions,
): Promise<Result<T>> {
  const urlResult = safeResolveUpstreamUrl(rawUrl);
  if (!urlResult.ok) return urlResult;

  const linked = createLinkedController(options?.timeoutMs ?? UPSTREAM_TIMEOUT_MS, options?.signal);
  try {
    const response = await fetch(
      urlResult.value.toString(),
      buildRequestInit(options, linked.controller.signal),
    );
    const statusError = mapHttpStatusToError(response);
    if (statusError) return err(statusError);

    const rawText = await readResponseTextWithLimit(
      response,
      options?.maxBytes ?? MAX_UPSTREAM_RESPONSE_BYTES,
    );
    return parseAndValidateBody(rawText, schema, urlResult.value.hostname);
  } catch (error) {
    return err(mapFetchException(error, linked.didTimeout()));
  } finally {
    linked.cleanup();
  }
}
