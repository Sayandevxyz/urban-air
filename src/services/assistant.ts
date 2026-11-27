import { z } from "zod";
import { LLM_TIMEOUT_MS, MAX_LLM_OUTPUT_TOKENS } from "@/lib/constants";
import { getEnv, type ValidatedEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateGroundedFallbackReply } from "@/services/assistantFallback";
import { buildSystemInstruction, buildUserEnvelope } from "@/services/assistantPrompt";
import {
  detectPromptInjection,
  DISCLAIMERS,
  isAirQualityTopic,
  OFF_TOPIC_MESSAGES,
  REFUSAL_MESSAGES,
  sanitizeAssistantOutput,
  sanitizeUserPrompt,
} from "@/services/assistantSanitize";
import { fetchJsonWithGuard } from "@/services/http";
import type { ChatRequestPayload } from "@/services/schemas";
import type { AssistantResponsePayload } from "@/types/api";

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })).optional(),
        }),
      }),
    )
    .optional(),
});

const anthropicResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
});

interface LlmCallParams {
  readonly apiKey: string;
  readonly systemInstruction: string;
  readonly userEnvelope: string;
  readonly signal?: AbortSignal | undefined;
}

async function tryGeminiLlm(env: ValidatedEnv, params: LlmCallParams): Promise<string | undefined> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`;
  const result = await fetchJsonWithGuard(url, geminiResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": params.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: params.userEnvelope }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: MAX_LLM_OUTPUT_TOKENS },
    }),
    timeoutMs: LLM_TIMEOUT_MS,
    signal: params.signal,
  });
  if (!result.ok) {
    logger.warn("Gemini call failed, falling back to grounded rules", { code: result.error.code });
    return undefined;
  }
  const text = result.value.candidates?.[0]?.content.parts?.[0]?.text;
  return text && text.trim().length > 0 ? text : undefined;
}

async function tryAnthropicLlm(
  env: ValidatedEnv,
  params: LlmCallParams,
): Promise<string | undefined> {
  const result = await fetchJsonWithGuard(
    "https://api.anthropic.com/v1/messages",
    anthropicResponseSchema,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: MAX_LLM_OUTPUT_TOKENS,
        system: params.systemInstruction,
        messages: [{ role: "user", content: params.userEnvelope }],
      }),
      timeoutMs: LLM_TIMEOUT_MS,
      signal: params.signal,
    },
  );
  if (!result.ok) {
    logger.warn("Anthropic call failed, falling back to grounded rules", {
      code: result.error.code,
    });
    return undefined;
  }
  const text = result.value.content?.find((item) => item.type === "text")?.text;
  return text && text.trim().length > 0 ? text : undefined;
}

async function selectConfiguredLlmReply(
  env: ValidatedEnv,
  systemInstruction: string,
  userEnvelope: string,
  signal?: AbortSignal,
): Promise<{ engine: "gemini" | "anthropic"; rawText: string } | undefined> {
  const allowGemini = env.LLM_PROVIDER === "gemini" || env.LLM_PROVIDER === "auto";
  if (allowGemini && env.GEMINI_API_KEY) {
    const rawText = await tryGeminiLlm(env, {
      apiKey: env.GEMINI_API_KEY,
      systemInstruction,
      userEnvelope,
      signal,
    });
    if (rawText) return { engine: "gemini", rawText };
  }
  const allowAnthropic = env.LLM_PROVIDER === "anthropic" || env.LLM_PROVIDER === "auto";
  if (allowAnthropic && env.ANTHROPIC_API_KEY) {
    const rawText = await tryAnthropicLlm(env, {
      apiKey: env.ANTHROPIC_API_KEY,
      systemInstruction,
      userEnvelope,
      signal,
    });
    if (rawText) return { engine: "anthropic", rawText };
  }
  return undefined;
}

function formatSuccessReply(
  rawText: string,
  engine: "gemini" | "anthropic" | "fallback",
  env: ValidatedEnv,
  baseMeta: Pick<AssistantResponsePayload, "dataSource" | "updatedAtIso" | "disclaimer">,
): AssistantResponsePayload {
  return {
    reply: sanitizeAssistantOutput(rawText, env),
    engine,
    refused: false,
    ...baseMeta,
  };
}

/**
 * Answers resident questions using prompt-injection defense, grounded server LLM calls when
 * configured, and deterministic rule-based fallback when no API keys exist or upstream models fail.
 */
export async function answerAirQualityQuestion(
  payload: ChatRequestPayload,
  signal?: AbortSignal,
): Promise<AssistantResponsePayload> {
  const env = getEnv();
  const locale = payload.locale;
  const cleaned = sanitizeUserPrompt(payload.message);
  const ctx = payload.airQualityContext;
  const baseMeta = {
    dataSource: `${ctx.cityName} (${ctx.source})`,
    updatedAtIso: ctx.updatedAtIso,
    disclaimer: DISCLAIMERS[locale],
  };

  if (cleaned.length === 0 || detectPromptInjection(cleaned)) {
    logger.warn("Blocked suspected prompt injection attempt", { locale });
    return { reply: REFUSAL_MESSAGES[locale], engine: "fallback", refused: true, ...baseMeta };
  }
  if (!isAirQualityTopic(cleaned)) {
    return { reply: OFF_TOPIC_MESSAGES[locale], engine: "fallback", refused: true, ...baseMeta };
  }

  const llmMatch = await selectConfiguredLlmReply(
    env,
    buildSystemInstruction(locale),
    buildUserEnvelope(cleaned, payload),
    signal,
  );
  if (llmMatch) {
    return formatSuccessReply(llmMatch.rawText, llmMatch.engine, env, baseMeta);
  }
  return formatSuccessReply(
    generateGroundedFallbackReply(cleaned, payload),
    "fallback",
    env,
    baseMeta,
  );
}
