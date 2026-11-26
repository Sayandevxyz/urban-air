import { AppError, err, ok, type Result } from "@/lib/errors";

/**
 * Safely parses a JSON string into a discriminated Result without throwing raw exceptions or casting.
 */
export function safeJsonParse(rawText: string): Result<unknown> {
  try {
    const parsed: unknown = JSON.parse(rawText);
    return ok(parsed);
  } catch (cause) {
    return err(new AppError("VALIDATION_ERROR", "Malformed JSON content.", 400, { cause }));
  }
}
