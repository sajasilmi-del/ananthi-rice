import en from "@/data/i18n/en.json";
import ta from "@/data/i18n/ta.json";
import type { Locale } from "@/lib/types";

export type Messages = typeof en;

export const dictionaries: Record<Locale, Messages> = {
  en,
  ta: ta as Messages,
};

export function t(locale: Locale, path: string): string {
  const value = readPath(dictionaries[locale], path);
  if (typeof value !== "string") {
    throw new Error(`Missing translation ${locale}.${path}`);
  }
  return value;
}

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function leafKeys(source: unknown, prefix = ""): string[] {
  if (typeof source === "string") return [prefix];
  if (!source || typeof source !== "object") return [];
  return Object.entries(source as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}
