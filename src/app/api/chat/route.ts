import { NextResponse } from "next/server";
import { MAX_CHAT_PAYLOAD_BYTES } from "@/lib/constants";
import { answerAirQualityQuestion } from "@/services/assistant";
import { parseJsonBody, withApiHandler } from "@/services/route-helpers";
import { chatRequestSchema } from "@/services/schemas";

/**
 * Grounded GenAI / rule-based assistant route with rate limiting, Zod validation, and prompt-injection defense.
 */
export const POST = withApiHandler("chat", async (request): Promise<NextResponse> => {
  const payload = await parseJsonBody(request, chatRequestSchema, MAX_CHAT_PAYLOAD_BYTES);
  const result = await answerAirQualityQuestion(payload, request.signal);
  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
});
