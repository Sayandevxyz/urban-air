import { useTranslations } from "next-intl";
import type { KeyboardEvent, SyntheticEvent } from "react";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/lib/constants";

interface ChatComposerProps {
  readonly input: string;
  readonly sending: boolean;
  readonly onChangeInput: (value: string) => void;
  readonly onSubmitQuestion: (questionText: string) => void;
}

/**
 * IME-safe chat message form enforcing maximum length constraints cleanly.
 */
export function ChatComposer({
  input,
  sending,
  onChangeInput,
  onSubmitQuestion,
}: ChatComposerProps) {
  const t = useTranslations("assistant");

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    onSubmitQuestion(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmitQuestion(input);
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
          value={input}
          placeholder={t("inputPlaceholder")}
          onChange={(event) => {
            onChangeInput(event.target.value);
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
  );
}
