"use client";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/components/Providers";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function NotFoundView() {
  const { locale } = useLanguage();
  return (
    <div className="stack">
      <SectionHeading as="h1" title={t(locale, "errors.notFoundTitle")} />
      <p>{t(locale, "errors.notFoundBody")}</p>
      <ButtonLink href="/" variant="primary">{t(locale, "nav.home")}</ButtonLink>
    </div>
  );
}
