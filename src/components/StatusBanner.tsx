// ============================================================================
// src/components/StatusBanner.tsx
// Renders loading, empty, offline snapshot, rate-limit cooldown, and retry UI.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { TONE_SURFACE_CLASSES } from "@/lib/constants";
import type { LoadState } from "@/types/api";

interface StatusBannerProps {
  readonly state: LoadState;
  readonly updatedAtIso?: string | undefined;
  readonly retryAfterSeconds: number;
  readonly onRetry: () => void;
}

const NEUTRAL_BOX_CLASS = "rounded-xl border border-borderc bg-surface-elevated p-5";
const WARN_BOX_CLASS = `rounded-xl p-4 ${TONE_SURFACE_CLASSES.amber}`;

function ErrorStatusCard({
  title,
  retryLabel,
  onRetry,
}: {
  readonly title: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${TONE_SURFACE_CLASSES.rose}`}
    >
      <div>
        <p className="text-base font-bold">{title}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] rounded-lg border-2 border-rose-800 bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900 dark:border-rose-200 dark:bg-rose-200 dark:text-rose-950"
      >
        {retryLabel}
      </button>
    </div>
  );
}

function NeutralStatusBox({ state }: { readonly state: "loading" | "empty" }) {
  const t = useTranslations("status");
  const isLoading = state === "loading";
  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-busy={isLoading ? "true" : undefined}
      className={NEUTRAL_BOX_CLASS}
    >
      <p className="text-base font-bold text-ink">{t(isLoading ? "loadingTitle" : "emptyTitle")}</p>
      <p className="mt-1 text-sm text-ink-muted">{t(isLoading ? "loadingBody" : "emptyBody")}</p>
    </div>
  );
}

/** Displays accessible loading, empty, error, offline cached, and rate-limited states. */
export function StatusBanner({
  state,
  updatedAtIso,
  retryAfterSeconds,
  onRetry,
}: StatusBannerProps) {
  const t = useTranslations("status");
  if (state === "ready") return null;
  if (state === "error")
    return (
      <ErrorStatusCard title={t("errorTitle")} retryLabel={t("errorRetry")} onRetry={onRetry} />
    );
  if (state === "loading" || state === "empty") return <NeutralStatusBox state={state} />;
  const isOffline = state === "offline";
  return (
    <div role={isOffline ? "status" : "alert"} className={WARN_BOX_CLASS}>
      <p className="text-base font-bold">{t(isOffline ? "offlineTitle" : "rateLimitedTitle")}</p>
      <p className="mt-1 text-sm">
        {isOffline
          ? t("offlineBody", { timestamp: updatedAtIso ?? "unknown" })
          : t("rateLimitedBody", { seconds: retryAfterSeconds })}
      </p>
    </div>
  );
}
