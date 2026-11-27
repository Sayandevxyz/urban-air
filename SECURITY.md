# Security

Evaluation criterion: Security — defense-in-depth input validation, SSRF/XSS/rate-limit protection, and responsible disclosure.

## 1. Input, Secret & Runtime Boundary Controls

- **Fail-Closed Validation**: API query params, bounds, enums, and JSON payloads are validated with Zod (`src/services/schemas.ts`), returning typed `400 VALIDATION_ERROR` responses. `parseJsonBody` (`src/services/route-helpers.ts`) enforces `Content-Type: application/json` (`415`) and pre-read `Content-Length` + actual byte caps (`413`).
- **Typed Client Boundaries**: `src/lib/errors.ts` (`toMap`, `toStr`, `toNum`, `toArr`) and `src/lib/api-client.ts` validate upstream API JSON and `localStorage` snapshots at runtime with zero unsafe `as` type casts.
- **Zero Client Secrets**: `src/lib/env.ts` blocks populated `NEXT_PUBLIC_*` names containing `key`, `secret`, `token`, or `password`. `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` are read strictly server-side.
- **Privacy by Default**: Geolocation coordinates stay in transient React state, skip `localStorage` (`!key.startsWith("geo-self-")`), return `Cache-Control: no-store`, and truncate `lat`/`lon`/`latitude`/`longitude` to 2 decimals in `src/lib/logger.ts`.

## 2. Security Headers, SSRF, Rate Limiting & GenAI Safety

- **Middleware & Headers (`src/middleware.ts`, `src/services/security.ts`, `next.config.ts`)**: Per-request cryptographic CSP nonces on both `script-src` and `style-src` (zero `'unsafe-inline'`, internal `x-nonce` stripped from HTTP responses), `COOP: same-origin`, `CORP: same-origin`, `X-DNS-Prefetch-Control: off`, `Cache-Control: no-store` on `/api/*`, `HSTS`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: geolocation=(self), ...`.
- **SSRF Guard (`src/services/http.ts`)**: `assertAllowedUpstreamUrl` restricts outbound requests to HTTPS on allowlisted Open-Meteo/Gemini/Anthropic hosts, blocks localhost/RFC1918/link-local IPs/embedded credentials, and enforces `AbortController` timeouts and streaming `1 MiB` byte limits.
- **Rate Limiting (`src/services/rate-limit.ts`)**: Per-IP token-bucket limiter on all routes plus a 24-hour `DAILY_LLM_MAX_REQUESTS` quota on `/api/chat`, `TRUST_PROXY`-gated IP extraction, returning `429 RATE_LIMITED` + `Retry-After`.
- **GenAI Guard (`src/services/assistant-sanitize.ts`, `src/services/assistant.ts`)**: Strips control/zero-width/bidi characters and prompt delimiters (`sanitizeUserPrompt`), detects jailbreaks/off-topic probes (`refused: true`), strips HTML/disallowed URLs on output, renders strictly as plain text (`0` `dangerouslySetInnerHTML`), and displays a prominent `"Not medical advice"` notice.

## 3. Automated Checks & Responsible Disclosure

- **Verified Checks (`scripts/audit.sh`)**: `npm audit --audit-level=high` (`0` vulnerabilities), `bash scripts/check-secrets.sh`, static scan (`0` secrets/`any`/`@ts-*`/`console.log`), Check 11 live `next start` probe (`/` CSP nonces + headers, `400` geocode, `415` chat MIME, `POST /api/chat` injection refusal), and SHA-pinned GitHub Actions (`CodeQL` + `Gitleaks` + `Dependabot`).
- **Reporting Vulnerabilities**: Do not open public issues with exploits. Submit private advisories via GitHub Security Advisories (supported on `main`; disclosure contact metadata in `public/.well-known/security.txt`, initial response target `48h`).
