"use client";

import { useTranslations } from "next-intl";
import { ChatComposer } from "@/components/ChatComposer";
import { ChatMessageList } from "@/components/ChatMessageList";
import { useAppLocale } from "@/components/LocaleContext";
import type { AirQualityReport, ResidentProfile } from "@/domain/types";
import { useChat } from "@/hooks/useChat";

interface AirQualityChatProps {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}

/**
 * Grounded AI assistant panel rendering responses strictly as plain text with zero HTML injection.
 */
export function AirQualityChat({ report, profile }: AirQualityChatProps) {
  const t = useTranslations("assistant");
  const { locale } = useAppLocale();
  const { input, setInput, sending, turns, errorText, submitQuestion } = useChat(
    report,
    profile,
    locale,
    {
      errorReply: t("errorReply"),
      fallbackBadge: t("fallbackBadge"),
      liveLlmBadge: t("liveLlmBadge"),
    },
  );

  const quickPrompts = [
    t("quickPrompts.smogPlan"),
    t("quickPrompts.indoorHacks"),
    t("quickPrompts.bestTime"),
    t("quickPrompts.familyProtect"),
  ];

  return (
    <section
      id="assistant"
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

      <ChatMessageList turns={turns} />

      {errorText && (
        <p role="alert" className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
          {errorText}
        </p>
      )}

      <ChatComposer
        input={input}
        sending={sending}
        onChangeInput={setInput}
        onSubmitQuestion={(text) => {
          void submitQuestion(text);
        }}
      />
    </section>
  );
}
