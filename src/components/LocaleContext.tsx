// ============================================================================
// src/components/LocaleContext.tsx
// Provides lazy-loaded runtime i18n catalogs (en/hi/ta) and <html lang> sync.
// ============================================================================

"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import enMessages from "@/i18n/en.json";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/constants";

/**
 * Strongly typed translation catalog structure derived from the canonical English dictionary.
 */
export type LocaleMessages = typeof enMessages;

const LOCALE_CACHE = new Map<SupportedLocale, LocaleMessages>([["en", enMessages]]);

/**
 * Loads the translation catalog for the requested locale on demand to keep initial JS minimal.
 */
export async function loadLocaleMessages(locale: SupportedLocale): Promise<LocaleMessages> {
  const cached = LOCALE_CACHE.get(locale);
  if (cached) return cached;
  switch (locale) {
    case "hi": {
      const mod = await import("@/i18n/hi.json");
      LOCALE_CACHE.set("hi", mod.default);
      return mod.default;
    }
    case "ta": {
      const mod = await import("@/i18n/ta.json");
      LOCALE_CACHE.set("ta", mod.default);
      return mod.default;
    }
    case "en":
    default:
      return enMessages;
  }
}

/** Preloads the requested locale translation catalog into memory for instant lookup. */
export function preloadLocaleMessages(locale: SupportedLocale): Promise<LocaleMessages> {
  return loadLocaleMessages(locale);
}

interface LocaleContextValue {
  readonly locale: SupportedLocale;
  readonly setLocale: (nextLocale: SupportedLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => undefined,
});

const LOCALE_STORAGE_KEY = "urban-air:locale:v1";

function isSupportedLocale(value: string | null): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((item) => item === value);
}

/**
 * Provides runtime locale switching (en/hi/ta) via next-intl and updates <html lang>.
 */
export function AppLocaleProvider({
  children,
  initialLocale = "en",
  initialMessages = enMessages,
}: {
  readonly children: ReactNode;
  readonly initialLocale?: SupportedLocale;
  readonly initialMessages?: LocaleMessages;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);
  const [initialTargetLocale] = useState(initialLocale);
  const [messages, setMessages] = useState<LocaleMessages>(initialMessages);

  const applyLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
    if (typeof document !== "undefined") {
      document.documentElement.lang = nextLocale;
    }
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Ignore storage failures in restricted browsing contexts.
    }
    void loadLocaleMessages(nextLocale).then((loaded) => {
      setMessages(loaded);
    });
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSupportedLocale(saved) && saved !== initialTargetLocale) {
        applyLocale(saved);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [applyLocale, initialTargetLocale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale: applyLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

/**
 * Exposes current locale code and setter for language toggle controls.
 */
export function useAppLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
