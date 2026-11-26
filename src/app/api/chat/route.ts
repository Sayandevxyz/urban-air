import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { answerAirQualityQuestion } from "@/services/assistant";
import { errorResponse, getRateLimiter } from "@/services/container";
import { enforceRateLimit } from "@/services/rate-limit";
import { chatRequestSchema } from "@/services/schemas";

/**
 * Grounded GenAI / rule-based assistant route with rate limiting, Zod validation, and prompt-injection defense.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await enforceRateLimit(getRateLimiter(), request.headers, "chat");

    const rawText = await request.text();
    if (Buffer.byteLength(rawText, "utf8") > 16_384) {
      throw new AppError("PAYLOAD_TOO_LARGE", "Chat payload exceeds maximum allowed size.", 413);
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText) as unknown;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Malformed JSON request body.", 400);
    }

    const parsed = chatRequestSchema.safeParse(rawJson);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid chat request payload.";
      throw new AppError("VALIDATION_ERROR", msg, 400);
    }

    const result = await answerAirQualityQuestion(parsed.data, request.signal);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
