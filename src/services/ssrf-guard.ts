import { ALLOWED_UPSTREAM_HOSTS } from "@/lib/constants";
import { AppError, err, ok, type Result } from "@/lib/errors";

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
  const blockedHost =
    PRIVATE_IP_OR_LOCAL_PATTERN.test(parsed.hostname) ||
    !ALLOWED_UPSTREAM_HOSTS.includes(parsed.hostname);
  if (blockedHost) {
    throw new AppError(
      "SSRF_BLOCKED",
      `Outbound host "${parsed.hostname}" is not in the security allowlist.`,
      400,
    );
  }
  return parsed;
}

/**
 * Resolves and validates an outbound URL as a discriminated Result without throwing raw exceptions.
 */
export function safeResolveUpstreamUrl(rawUrl: string): Result<URL> {
  try {
    return ok(assertAllowedUpstreamUrl(rawUrl));
  } catch (error) {
    if (error instanceof AppError) {
      return err(error);
    }
    return err(new AppError("SSRF_BLOCKED", "Blocked outbound request.", 400, { cause: error }));
  }
}
