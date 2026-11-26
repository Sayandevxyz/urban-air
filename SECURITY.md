# Security Policy — Urban Air Quality Assistant

## Supported Versions

| Version | Supported    |
| ------- | ------------ |
| `main`  | Yes (Active) |

## Reporting a Vulnerability

Please report security vulnerabilities responsibly:

1. **Do not** open a public GitHub issue containing exploit payloads, credentials, or reproduction details.
2. Submit a private report via [GitHub Security Advisories](https://github.com/Sayandevxyz/urban-air/security/advisories/new).
3. Include affected files, HTTP request/response reproduction steps, impact assessment, and any suggested fix.

### Disclosure Timeline

- **Initial acknowledgment**: within 48 hours.
- **Triage & fix plan**: within 5 business days.
- **Advisory & release**: coordinated upon patch verification.

## Security Architecture Highlights

- Strict nonce-gated `Content-Security-Policy` without `'unsafe-inline'` scripts or styles.
- `TRUST_PROXY`-gated rate limiting (`src/services/rate-limit.ts`) with daily per-IP LLM quota protection on `/api/chat`.
- SSRF allowlist & streaming response size caps on outbound upstream requests (`src/services/http.ts`).
- Strict `application/json` (`415`), `Content-Length` pre-read guards (`413`), and Zod validation across all API routes.
- Full threat model & verification notes: see [docs/SECURITY.md](docs/SECURITY.md).
