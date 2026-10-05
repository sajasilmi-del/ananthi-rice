"use client";

import { faq } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/components/Providers";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function FaqPage() {
  const { locale } = useLanguage();
  return (
    <div className="narrow-page">
      <header className="shop-head">
        <SectionHeading as="h1" title={t(locale, "faq.title")} />
        <p className="lede">{t(locale, "home.faqLead")}</p>
      </header>
      <div className="faq-list">
        {faq.map((item) => (
          <details key={item.id}>
            <summary>{locale === "ta" ? item.questionTamil : item.questionEnglish}</summary>
            <p>{locale === "ta" ? item.answerTamil : item.answerEnglish}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
