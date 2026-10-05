import type { Locale } from "@/lib/types";

export const LANGUAGE_STORAGE_KEY = "ananthi.language";
export const LANGUAGE_COOKIE = "ananthi_lang";
export const LANGUAGE_HEADER = "x-ananthi-lang";

export function parseLocale(value: string | undefined | null): Locale | null {
  return value === "ta" || value === "en" ? value : null;
}

export function detectBrowserLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith("ta") ? "ta" : "en";
}

export function readStoredLocale(storage: Pick<Storage, "getItem">): Locale | null {
  const value = storage.getItem(LANGUAGE_STORAGE_KEY);
  return value === "ta" || value === "en" ? value : null;
}

export function persistLocale(locale: Locale): void {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  document.cookie = `${LANGUAGE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
  document.documentElement.lang = locale;
}
