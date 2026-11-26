import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

/**
 * Reports service liveness and non-sensitive capability flags (never exposes keys).
 */
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
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
