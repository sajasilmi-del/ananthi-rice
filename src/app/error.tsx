"use client";

import { t } from "@/lib/i18n";
import { useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { locale } = useLanguage();
  return (
    <div className="stack">
      <SectionHeading as="h1" title={t(locale, "errors.genericTitle")} />
      <p>{t(locale, "errors.genericBody")}</p>
      <Button onClick={reset}>{t(locale, "errors.retry")}</Button>
    </div>
  );
}
