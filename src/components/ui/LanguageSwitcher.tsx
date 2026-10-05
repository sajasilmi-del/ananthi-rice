"use client";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/components/Providers";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  return (
    <div className="lang-switch" role="group" aria-label={t(locale, "header.languageLabel")}>
      <button type="button" className="lang-option" lang="ta" data-testid="lang-ta" aria-pressed={locale === "ta"} onClick={() => setLocale("ta")}>
        {t(locale, "header.tamilName")}
      </button>
      <span aria-hidden="true"> | </span>
      <button type="button" className="lang-option" lang="en" data-testid="lang-en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>
        {t(locale, "header.englishName")}
      </button>
    </div>
  );
}
