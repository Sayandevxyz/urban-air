import { describe, expect, it } from "vitest";
import { loadLocaleMessages } from "@/components/LocaleContext";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import ta from "@/i18n/ta.json";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(value)) {
      keys.push(...collectLeafKeys(value, path));
    } else {
      keys.push(path);
      expect(typeof value).toBe("string");
      expect(String(value).trim().length).toBeGreaterThan(0);
    }
  }
  return keys.sort();
}

describe("i18n message catalogs", () => {
  it("maintains 100% key parity and non-empty translations across en, hi, and ta", () => {
    const enKeys = collectLeafKeys(en);
    const hiKeys = collectLeafKeys(hi);
    const taKeys = collectLeafKeys(ta);

    expect(hiKeys).toEqual(enKeys);
    expect(taKeys).toEqual(enKeys);
  });

  it("dynamically loads each locale catalog cleanly", async () => {
    const loadedEn = await loadLocaleMessages("en");
    const loadedHi = await loadLocaleMessages("hi");
    const loadedTa = await loadLocaleMessages("ta");

    expect(loadedEn.app.title).toBe(en.app.title);
    expect(loadedHi.app.title).toBe(hi.app.title);
    expect(loadedTa.app.title).toBe(ta.app.title);
  });
});
