// ============================================================================
// src/components/AppHeader.tsx
// Renders skip link, title, Demo Mode toggle, language switcher, and nav links.
// ============================================================================

"use client";

import { useTranslations } from "next-intl";
import { useAppLocale } from "@/components/LocaleContext";
import type { SupportedLocale } from "@/lib/constants";

interface AppHeaderProps {
  readonly demoMode: boolean;
  readonly onToggleDemoMode: () => void;
}

const LOCALE_LABELS: Readonly<Record<SupportedLocale, string>> = {
  en: "English",
  hi: "हिन्दी",
  ta: "தமிழ்",
};

function HeaderNav() {
  const t = useTranslations("app");
  const links = [
    ["#dashboard", t("navDashboard")],
    ["#forecast", t("navForecast")],
    ["#guidance", t("navGuidance")],
    ["#routines", t("navRoutines")],
    ["#assistant", t("navAssistant")],
    ["#compare", t("navCompare")],
    ["#alerts", t("navAlerts")],
  ] as const;

  return (
    <nav aria-label={t("navLabel")} className="overflow-x-auto pb-1">
      <ul className="flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <a
              href={href}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-borderc bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function HeaderModeControls({ demoMode, onToggleDemoMode }: AppHeaderProps) {
  const t = useTranslations("app");
  const { locale, setLocale } = useAppLocale();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={demoMode}
        onClick={onToggleDemoMode}
        className={`min-h-[44px] rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-colors ${
          demoMode
            ? "border-accent bg-accent text-accent-ink"
            : "border-borderc-strong bg-surface text-ink hover:bg-surface-muted"
        }`}
      >
        {t("demoModeToggle")}: {demoMode ? t("demoModeOn") : t("demoModeOff")}
      </button>

      <div className="flex items-center gap-2">
        <label htmlFor="language-select" className="text-sm font-semibold text-ink">
          {t("languageLabel")}
        </label>
        <select
          id="language-select"
          name="language"
          value={locale}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "en" || value === "hi" || value === "ta") setLocale(value);
          }}
          className="min-h-[44px] rounded-lg border-2 border-borderc-strong bg-surface-elevated px-3 py-2 text-base font-medium text-ink"
        >
          {(["en", "hi", "ta"] as const).map((code) => (
            <option key={code} value={code}>
              {LOCALE_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Semantic header landmark with skip link, Demo mode switch, language toggle, and links. */
export function AppHeader({ demoMode, onToggleDemoMode }: AppHeaderProps) {
  const t = useTranslations("app");
  return (
    <header className="border-b border-borderc bg-surface-elevated">
      <a
        href="#main-content"
        className="visually-hidden fixed left-3 top-3 z-50 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-md"
      >
        {t("skipLink")}
      </a>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1
              id="main-content"
              tabIndex={-1}
              className="font-bold tracking-tight text-ink [font-size:clamp(1.5rem,1.2rem+1.5vw,2.25rem)]"
            >
              {t("title")}
            </h1>
            <p className="mt-1 text-base text-ink-muted">{t("subtitle")}</p>
          </div>
          <HeaderModeControls demoMode={demoMode} onToggleDemoMode={onToggleDemoMode} />
        </div>
        <HeaderNav />
      </div>
    </header>
  );
}
