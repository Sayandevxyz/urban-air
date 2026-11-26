"use client";

import { useTranslations } from "next-intl";

/**
 * Semantic footer landmark presenting attribution and non-medical disclaimer.
 */
export function AppFooter() {
  const t = useTranslations("app");
  return (
    <footer className="mt-10 border-t border-borderc bg-surface-elevated">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-sm text-ink-muted">
        <p className="font-medium text-ink">{t("disclaimerShort")}</p>
        <p>{t("footerNote")}</p>
      </div>
    </footer>
  );
}
