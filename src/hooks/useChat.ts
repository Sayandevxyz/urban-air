"use client";

import { useState } from "react";
import { scoreActivityWindows } from "@/domain/planner";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";
import { fetchApiJson } from "@/hooks/apiClient";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { SupportedLocale } from "@/lib/constants";
import type { ChatRequestPayload } from "@/services/schemas";

export interface ChatTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly meta?: string | undefined;
}

interface ChatApiSuccess {
  readonly reply: string;
  readonly engine: "gemini" | "anthropic" | "fallback";
  readonly refused: boolean;
  readonly dataSource: string;
  readonly updatedAtIso: string;
  readonly disclaimer: string;
}

/**
 * Constructs a validated grounded chat request body from the active city report and resident profile.
 */
function buildChatRequest(
  questionText: string,
  report: AirQualityReport,
  profile: ResidentProfile,
  locale: SupportedLocale,
): ChatRequestPayload {
  const walkBest = scoreActivityWindows(report.hourly, "walk", profile.persona).bestWindow;
  return {
    message: questionText.trim(),
    locale,
    profile,
    airQualityContext: {
      cityName: report.location.name,
      country: report.location.country || "Local",
      source: report.source,
      updatedAtIso: report.updatedAtIso,
      usAqi: report.current.usAqi,
      europeanAqi: report.current.europeanAqi,
      readings: report.current.readings,
      ...(walkBest ? { bestWindowIso: walkBest.timeIso, bestWindowUsAqi: walkBest.usAqi } : {}),
    },
  };
}

/**
 * Dispatches a grounded chat request to POST /api/chat via the shared API client.
 */
function sendChatRequest(payload: ChatRequestPayload, signal?: AbortSignal) {
  return fetchApiJson<ChatApiSuccess>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}

/**
 * Formats an assistant turn payload for display cleanly as plain text.
 */
function applyChatReply(
  data: ChatApiSuccess,
  labels: { readonly fallbackBadge: string; readonly liveLlmBadge: string },
): ChatTurn {
  const engineBadge = data.engine === "fallback" ? labels.fallbackBadge : labels.liveLlmBadge;
  return {
    id: `a-${Date.now()}`,
    role: "assistant",
    text: data.reply,
    meta: `${engineBadge} · ${data.dataSource}`,
  };
}

/**
 * Manages grounded AI chat turns, request submission, and safe plain-text response updates.
 */
export function useChat(
  report: AirQualityReport,
  profile: ResidentProfile,
  locale: SupportedLocale,
  labels: {
    readonly errorReply: string;
    readonly fallbackBadge: string;
    readonly liveLlmBadge: string;
  },
) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const { nextSignal } = useAsyncResource();

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;
    setErrorText(null);
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
    setInput("");
    setSending(true);

    const payload = buildChatRequest(trimmed, report, profile, locale);
    const res = await sendChatRequest(payload, nextSignal());
    if (res.ok) {
      setTurns((prev) => [...prev, applyChatReply(res.data, labels)]);
    } else if (res.kind !== "aborted") {
      setErrorText(labels.errorReply);
    }
    setSending(false);
  };

  return { input, setInput, sending, turns, errorText, submitQuestion };
}
