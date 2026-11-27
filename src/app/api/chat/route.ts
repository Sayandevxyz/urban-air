// ============================================================================
// src/app/api/chat/route.ts
// Serves grounded AI or rule-based answers with burst and daily rate limits.
// ============================================================================

import { NextResponse } from "next/server";
import { HTTP_STATUS, MAX_CHAT_PAYLOAD_BYTES } from "@/lib/constants";
import { answerAirQualityQuestion } from "@/services/assistant";
import { getDailyLlmRateLimiter } from "@/services/container";
import { enforceRateLimit } from "@/services/rate-limit";
import { parseJsonBody, withApiHandler } from "@/services/route-helpers";
import { chatRequestSchema } from "@/services/schemas";

/**
 * Grounded GenAI / rule-based assistant route with burst + daily per-IP rate limiting,
 * strict Content-Type checks, Zod validation, and prompt-injection defense.
 */
export const POST = withApiHandler("chat", async (request): Promise<NextResponse> => {
  await enforceRateLimit(getDailyLlmRateLimiter(), request.headers, "chat-daily");
  const payload = await parseJsonBody(request, chatRequestSchema, MAX_CHAT_PAYLOAD_BYTES);
  const result = await answerAirQualityQuestion(payload, request.signal);
  return NextResponse.json(result, {
    status: HTTP_STATUS.OK,
    headers: { "Cache-Control": "no-store" },
  });
});
