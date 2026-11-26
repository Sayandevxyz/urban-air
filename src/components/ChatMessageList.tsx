import { useTranslations } from "next-intl";
import type { ChatTurn } from "@/hooks/useChat";

interface ChatMessageListProps {
  readonly turns: readonly ChatTurn[];
}

/**
 * Accessible live region displaying grounded assistant and user chat turns strictly as plain text.
 */
export function ChatMessageList({ turns }: ChatMessageListProps) {
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
