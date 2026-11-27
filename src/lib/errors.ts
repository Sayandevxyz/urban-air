/**
 * Centralized application error codes used across domain, service, and API layers.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_TIMEOUT"
  | "RATE_LIMITED"
  | "SSRF_BLOCKED"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "CONFIG_ERROR"
  | "INTERNAL_ERROR"
  | "PROMPT_INJECTION_BLOCKED";

/**
 * Structured application error separating safe client messages from internal context.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly safeMessage: string;
  public readonly retryAfterSeconds: number | undefined;

  /**
   * Creates an AppError with an explicit error code, HTTP status, and client-safe message.
   */
  public constructor(
    code: ErrorCode,
    safeMessage: string,
    statusCode: number,
    options?: {
      cause?: unknown;
      retryAfterSeconds?: number;
    },
  ) {
    super(safeMessage, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.safeMessage = safeMessage;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

/**
 * Typed discriminated result returned at service boundaries instead of throwing raw errors.
 */
export type Result<T, E = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Constructs a successful Result value.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Constructs a failed Result containing a typed error.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Safe public error payload guaranteed never to expose stack traces or secret internals.
 */
export interface SafeErrorPayload {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryAfterSeconds?: number;
  };
}

/**
 * Converts an unknown thrown value or AppError into a client-safe HTTP response payload and status.
 */
export function toSafeErrorResponse(input: unknown): {
  readonly statusCode: number;
  readonly body: SafeErrorPayload;
} {
  if (input instanceof AppError) {
    const errorBody: SafeErrorPayload["error"] =
      input.retryAfterSeconds !== undefined
        ? {
            code: input.code,
            message: input.safeMessage,
            retryAfterSeconds: input.retryAfterSeconds,
          }
        : {
            code: input.code,
            message: input.safeMessage,
          };
    return {
      statusCode: input.statusCode,
      body: { error: errorBody },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while processing the request.",
      },
    },
  };
}

/**
 * Safely parses a JSON string into a discriminated Result without throwing raw exceptions.
 */
export function safeJsonParse(rawText: string): Result<unknown> {
  try {
    const parsed: unknown = JSON.parse(rawText);
    return ok(parsed);
  } catch (cause) {
    return err(new AppError("VALIDATION_ERROR", "Malformed JSON content.", 400, { cause }));
  }
}
