"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { enMessages, loadLocaleMessages, type LocaleMessages } from "@/i18n/catalog";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/constants";

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
      if (isSupportedLocale(saved) && saved !== locale) {
        applyLocale(saved);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [applyLocale, locale]);

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
