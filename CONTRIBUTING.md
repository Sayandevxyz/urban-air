# Contributing to Urban Air Quality Assistant

Thank you for helping improve air-quality clarity and climate resilience for urban residents and families.

## Development Workflow

1. **Setup**:
   ```bash
   cp .env.example .env.local
   npm ci
   npm run dev
   ```
2. **Code Standards**:
   - Follow the layered architecture (`src/domain` -> `src/services` -> `src/app/api` / `src/components`).
   - Keep `src/domain` 100% pure (zero I/O, zero React, zero browser globals) and 100% unit-tested.
   - Use TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); never use `any`, `@ts-ignore`, non-null assertions (`!`), or `console.log`.
   - Keep functions focused (< 40 lines), document exported symbols with JSDoc explaining _why_, and extract named constants with units.
   - Every user-visible string belongs in `src/i18n/messages/{en,hi,ta}.json`.
3. **Commit Convention**:
   - Use Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `perf:`, `security:`, `a11y:`.
4. **Before Opening a PR**:
   Run `npm run verify` and `npm run test:e2e` and ensure all checks pass with zero warnings.
