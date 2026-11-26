import enMessages from "@/i18n/messages/en.json";
import type { SupportedLocale } from "@/lib/constants";

/**
 * Strongly typed translation catalog structure derived from the canonical English dictionary.
 */
export type LocaleMessages = typeof enMessages;

/**
 * Loads the translation catalog for the requested locale on demand to keep initial JS minimal.
 */
export async function loadLocaleMessages(locale: SupportedLocale): Promise<LocaleMessages> {
  switch (locale) {
    case "hi": {
      const mod = await import("@/i18n/messages/hi.json");
      return mod.default;
    }
    case "ta": {
      const mod = await import("@/i18n/messages/ta.json");
      return mod.default;
    }
    case "en":
    default:
      return enMessages;
  }
}

export { enMessages };
