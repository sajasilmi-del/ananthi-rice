import { cookies, headers } from "next/headers";
import { LANGUAGE_COOKIE, LANGUAGE_HEADER, parseLocale } from "@/lib/language";
import type { Locale } from "@/lib/types";

export async function requestLocale(): Promise<Locale> {
  const headerStore = await headers();
  const fromHeader = parseLocale(headerStore.get(LANGUAGE_HEADER));
  if (fromHeader) return fromHeader;
  const store = await cookies();
  return parseLocale(store.get(LANGUAGE_COOKIE)?.value) ?? "en";
}

export async function requestPath(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("x-ananthi-path") ?? "/";
}
