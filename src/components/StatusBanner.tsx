"use client";

import { useTranslations } from "next-intl";
import type { LoadState } from "@/hooks/useAirQualityData";

interface StatusBannerProps {
  readonly state: LoadState;
  readonly updatedAtIso?: string | undefined;
  readonly retryAfterSeconds: number;
  readonly onRetry: () => void;
}

/**
 * Displays accessible loading, empty, error, offline cached, and rate-limited states.
 */
export function StatusBanner({
  state,
  updatedAtIso,
  retryAfterSeconds,
  onRetry,
}: StatusBannerProps) {
  const t = useTranslations("status");

  if (state === "ready") {
    return null;
  }

  if (state === "loading") {
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-xl border border-borderc bg-surface-elevated p-5"
      >
        <p className="text-base font-bold text-ink">{t("loadingTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("loadingBody")}</p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="rounded-xl border border-borderc bg-surface-elevated p-5">
        <p className="text-base font-bold text-ink">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-ink-muted">{t("emptyBody")}</p>
      </div>
    );
  }

  if (state === "offline") {
    return (
      <div
        role="status"
        className="rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100"
      >
        <p className="text-base font-bold">{t("offlineTitle")}</p>
        <p className="mt-1 text-sm">{t("offlineBody", { timestamp: updatedAtIso ?? "unknown" })}</p>
      </div>
    );
  }

  if (state === "rate_limited") {
    return (
      <div
        role="alert"
        className="rounded-xl border-2 border-amber-700 bg-amber-50 p-4 text-amber-950 dark:border-amber-400 dark:bg-amber-950/60 dark:text-amber-100"
      >
        <p className="text-base font-bold">{t("rateLimitedTitle")}</p>
        <p className="mt-1 text-sm">{t("rateLimitedBody", { seconds: retryAfterSeconds })}</p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-rose-700 bg-rose-50 p-4 text-rose-950 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-100"
    >
      <div>
        <p className="text-base font-bold">{t("errorTitle")}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[44px] rounded-lg border-2 border-rose-800 bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900 dark:border-rose-200 dark:bg-rose-200 dark:text-rose-950"
      >
        {t("errorRetry")}
      </button>
    </div>
  );
}
