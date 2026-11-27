// ============================================================================
// src/components/AirQualityChat.tsx
// Renders grounded AI chat prompts, plain-text conversation turns, and input.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, SyntheticEvent } from "react";
import { useAppLocale } from "@/components/LocaleContext";
import { useChat } from "@/hooks/useChat";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/constants";
import type { AirQualityReport } from "@/types/air-quality";
import type { ChatTurn } from "@/types/api";
import type { ResidentProfile } from "@/types/guidance";

const QUICK_PROMPT_KEYS = [
  "quickPrompts.smogPlan",
  "quickPrompts.indoorHacks",
  "quickPrompts.bestTime",
  "quickPrompts.familyProtect",
] as const;

const isSubmitKey = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing;

function ChatMessageList({ turns }: { readonly turns: readonly ChatTurn[] }) {
  const t = useTranslations("assistant");
  return (
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
  );
}

function ChatQuickPrompts({
  sending,
  onSelectPrompt,
}: {
  readonly sending: boolean;
  readonly onSelectPrompt: (text: string) => void;
}) {
  const t = useTranslations("assistant");
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {QUICK_PROMPT_KEYS.map((key) => {
        const text = t(key);
        return (
          <button
            key={key}
            type="button"
            disabled={sending}
            onClick={() => {
              onSelectPrompt(text);
            }}
            className="min-h-[44px] rounded-full border border-borderc-strong bg-surface px-3.5 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-muted disabled:opacity-50"
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

function ChatComposer({ chat }: { readonly chat: ReturnType<typeof useChat> }) {
  const t = useTranslations("assistant");
  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    void chat.submitQuestion(chat.input);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitKey(event)) {
      event.preventDefault();
      void chat.submitQuestion(chat.input);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <label htmlFor="chat-message-input" className="block text-sm font-semibold text-ink">
        {t("inputLabel")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          id="chat-message-input"
          rows={2}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          value={chat.input}
          placeholder={t("inputPlaceholder")}
          onChange={(e) => {
            chat.setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          className="min-h-[48px] flex-1 rounded-lg border-2 border-borderc-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={chat.sending || chat.input.trim().length === 0}
          className="min-h-[48px] shrink-0 rounded-lg border-2 border-accent bg-accent px-5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
        >
          {t(chat.sending ? "sending" : "sendButton")}
        </button>
      </div>
    </form>
  );
}

function ChatNotices({ report }: { readonly report: AirQualityReport }) {
  const t = useTranslations("assistant");
  return (
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
  );
}

/** Grounded AI assistant panel rendering responses strictly as plain text with zero HTML injection. */
export function AirQualityChat({
  report,
  profile,
}: {
  readonly report: AirQualityReport;
  readonly profile: ResidentProfile;
}) {
  const t = useTranslations("assistant");
  const { locale } = useAppLocale();
  const chat = useChat(report, profile, locale, {
    errorReply: t("errorReply"),
    fallbackBadge: t("fallbackBadge"),
    liveLlmBadge: t("liveLlmBadge"),
  });

  return (
    <section
      id="assistant"
      className="rounded-xl border border-borderc bg-surface-elevated p-4 shadow-sm sm:p-6"
    >
      <h2 id="assistant-heading" className="text-xl font-bold text-ink">
        {t("sectionTitle")}
      </h2>
      <ChatNotices report={report} />
      <ChatQuickPrompts
        sending={chat.sending}
        onSelectPrompt={(p) => {
          void chat.submitQuestion(p);
        }}
      />
      <ChatMessageList turns={chat.turns} />
      {chat.errorText && (
        <p role="alert" className="mt-2 text-sm font-semibold text-rose-800 dark:text-rose-200">
          {chat.errorText}
        </p>
      )}
      <ChatComposer chat={chat} />
    </section>
  );
}
