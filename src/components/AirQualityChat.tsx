"use client";

import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { useAppLocale } from "@/components/LocaleContext";
import { scoreActivityWindows } from "@/domain/planner";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/constants";

interface AirQualityChatProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}

interface ChatTurn {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly meta?: string | undefined;
}

interface ChatApiSuccess {
  reply: string;
  engine: "gemini" | "anthropic" | "fallback";
  refused: boolean;
  dataSource: string;
  updatedAtIso: string;
  disclaimer: string;
}

/**
 * Grounded AI assistant panel rendering responses strictly as plain text with zero HTML injection.
 */
export function AirQualityChat({ report, profile }: AirQualityChatProps) {
  const t = useTranslations("assistant");
  const { locale } = useAppLocale();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  const walkBest = scoreActivityWindows(report.hourly, "walk", profile.persona).bestWindow;

  const submitQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) {
      return;
    }
    setErrorText(null);
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
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
            ...(walkBest
              ? { bestWindowIso: walkBest.timeIso, bestWindowUsAqi: walkBest.usAqi }
              : {}),
          },
        }),
      });

      if (!response.ok) {
        setErrorText(t("errorReply"));
        return;
      }

      const data = (await response.json()) as ChatApiSuccess;
      const engineBadge = data.engine === "fallback" ? t("fallbackBadge") : t("liveLlmBadge");
      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data.reply,
        meta: `${engineBadge} · ${data.dataSource}`,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch {
      setErrorText(t("errorReply"));
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    void submitQuestion(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submitQuestion(input);
    }
  };

  const quickPrompts = [
    t("quickPrompts.smogPlan"),
    t("quickPrompts.indoorHacks"),
    t("quickPrompts.bestTime"),
    t("quickPrompts.familyProtect"),
  ];

  return (
    <section
      id="assistant"
      aria-labelledby="assistant-heading"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="assistant-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>

      <div className="mt-2 space-y-1 rounded-lg border border-borderc bg-surface p-3 text-xs text-ink-muted">
        <p className="font-semibold text-ink">{t("medicalNotice")}</p>
        <p>
          {t("sourceNotice", {
            city: report.location.name,
            source: report.source,
            updated: report.updatedAtIso,
          })}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((promptText) => (
          <button
            key={promptText}
            type="button"
            disabled={sending}
            onClick={() => {
              void submitQuestion(promptText);
            }}
            className="min-h-[44px] rounded-full border border-borderc-strong bg-surface px-3.5 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            {promptText}
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-borderc bg-surface p-4"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("emptyIntro")}</p>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`rounded-lg p-3 text-sm ${
                turn.role === "user"
                  ? "ml-auto max-w-[85%] bg-accent text-accent-ink"
                  : "mr-auto max-w-[92%] border border-borderc bg-surface-elevated text-ink"
              }`}
            >
              <p className="whitespace-pre-wrap">{turn.text}</p>
              {turn.meta && (
                <p className="mt-1.5 text-xs font-semibold text-ink-muted">{turn.meta}</p>
              )}
            </div>
          ))
        )}
      </div>

      {errorText && (
        <p role="alert" className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
          {errorText}
        </p>
      )}

      <form onSubmit={handleFormSubmit} className="mt-4 space-y-2">
        <label htmlFor="chat-message-input" className="block text-sm font-semibold text-ink">
          {t("inputLabel")}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <textarea
            id="chat-message-input"
            rows={2}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            value={input}
            placeholder={t("inputPlaceholder")}
            onChange={(event) => {
              setInput(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="min-h-[48px] flex-1 rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted"
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            className="min-h-[48px] shrink-0 rounded-lg border-2 border-accent bg-accent px-5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {sending ? t("sending") : t("sendButton")}
          </button>
        </div>
      </form>
    </section>
  );
}
