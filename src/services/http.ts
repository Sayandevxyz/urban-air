import type { z } from "zod";
import {
  ALLOWED_UPSTREAM_HOSTS,
  MAX_UPSTREAM_RESPONSE_BYTES,
  UPSTREAM_TIMEOUT_MS,
} from "@/lib/constants";
import { AppError, err, ok, type Result } from "@/lib/errors";
import { logger } from "@/lib/logger";

const PRIVATE_IP_OR_LOCAL_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

/**
 * Validates that an outbound URL targets HTTPS on an explicitly allowlisted host (SSRF defense).
 */
export function assertAllowedUpstreamUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("SSRF_BLOCKED", "Blocked malformed outbound request target.", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new AppError("SSRF_BLOCKED", "Outbound requests must use HTTPS.", 400);
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new AppError("SSRF_BLOCKED", "Outbound URLs must not contain embedded credentials.", 400);
  }

  if (
    PRIVATE_IP_OR_LOCAL_PATTERN.test(parsed.hostname) ||
    !ALLOWED_UPSTREAM_HOSTS.includes(parsed.hostname)
  ) {
    throw new AppError(
      "SSRF_BLOCKED",
      `Outbound host "${parsed.hostname}" is not in the security allowlist.`,
      400,
    );
  }

  return parsed;
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

  if (!response.body) {
    const fallbackText = await response.text();
    if (Buffer.byteLength(fallbackText, "utf8") > maxBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Upstream response exceeded maximum size limit.",
        502,
      );
    }
    return fallbackText;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  let readResult = await reader.read();
  while (!readResult.done) {
    const chunk = readResult.value;
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "Upstream response exceeded maximum size limit.",
        502,
      );
    }
    chunks.push(chunk);
    readResult = await reader.read();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

function createLinkedController(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): {
  controller: AbortController;
  didTimeout: () => boolean;
  cleanup: () => void;
} {
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
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
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

/**
 * Fetches JSON from an allowlisted HTTPS endpoint with timeout, byte cap, and Zod validation.
 */
export async function fetchJsonWithGuard<T>(
  rawUrl: string,
  schema: z.ZodType<T>,
  options?: {
    method?: "GET" | "POST";
    headers?: Readonly<Record<string, string>>;
    body?: string;
    timeoutMs?: number;
    maxBytes?: number;
    signal?: AbortSignal | undefined;
  },
): Promise<Result<T>> {
  let targetUrl: URL;
  try {
    targetUrl = assertAllowedUpstreamUrl(rawUrl);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(new AppError("SSRF_BLOCKED", "Blocked outbound request.", 400, { cause: error }));
  }

  const timeoutMs = options?.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? MAX_UPSTREAM_RESPONSE_BYTES;
  const linked = createLinkedController(timeoutMs, options?.signal);

  try {
    const requestInit: RequestInit = {
      method: options?.method ?? "GET",
      signal: linked.controller.signal,
      ...(options?.headers ? { headers: options.headers } : {}),
      ...(options?.body !== undefined ? { body: options.body } : {}),
    };
    const response = await fetch(targetUrl.toString(), requestInit);

    if (response.status === 429) {
      const retryRaw = response.headers.get("retry-after");
      const retryParsed = retryRaw !== null ? Number.parseInt(retryRaw, 10) : 60;
      const retryAfterSeconds = Number.isFinite(retryParsed) && retryParsed > 0 ? retryParsed : 60;
      return err(
        new AppError("RATE_LIMITED", "Upstream service is temporarily rate limited.", 429, {
          retryAfterSeconds,
        }),
      );
    }

    if (!response.ok) {
      return err(
        new AppError(
          "UPSTREAM_ERROR",
          `Upstream data service returned status ${response.status}.`,
          502,
        ),
      );
    }

    const rawText = await readResponseTextWithLimit(response, maxBytes);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText) as unknown;
    } catch (parseError) {
      return err(
        new AppError("UPSTREAM_ERROR", "Upstream service returned malformed JSON.", 502, {
          cause: parseError,
        }),
      );
    }

    const validated = schema.safeParse(parsedJson);
    if (!validated.success) {
      logger.warn("Upstream schema mismatch", { host: targetUrl.hostname });
      return err(
        new AppError("UPSTREAM_ERROR", "Upstream response did not match expected format.", 502),
      );
    }

    return ok(validated.data);
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    if (linked.didTimeout()) {
      return err(new AppError("UPSTREAM_TIMEOUT", "Upstream data service timed out.", 504));
    }
    return err(
      new AppError("UPSTREAM_ERROR", "Unable to reach upstream data service.", 502, {
        cause: error,
      }),
    );
  } finally {
    linked.cleanup();
  }
}
