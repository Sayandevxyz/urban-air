// ============================================================================
// src/app/api/health/route.ts
// Exposes non-sensitive service liveness and mode flags for health checks.
// ============================================================================

import { NextResponse } from "next/server";
import { HTTP_STATUS } from "@/lib/constants";
import { getEnv } from "@/lib/env";

/** Reports service liveness and non-sensitive capability flags without exposing keys. */
export function GET(): NextResponse {
  const env = getEnv();
  const llmConfigured =
    env.LLM_PROVIDER !== "fallback" &&
    (Boolean(env.GEMINI_API_KEY) || Boolean(env.ANTHROPIC_API_KEY));

  return NextResponse.json(
    {
      status: "ok",
      llmConfigured,
      demoModeDefault: env.NEXT_PUBLIC_DEFAULT_DEMO_MODE === "true",
    },
    { status: HTTP_STATUS.OK, headers: { "Cache-Control": "no-store" } },
  );
}
