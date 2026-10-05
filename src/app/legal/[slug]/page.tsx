"use client";

import { notFound, useParams } from "next/navigation";
import { legalPages, site } from "@/lib/catalog";
import { useLanguage } from "@/components/Providers";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function LegalPage() {
  const { locale } = useLanguage();
  const params = useParams<{ slug: string }>();
  const page = legalPages.find((item) => item.id === params.slug);
  if (!page) notFound();
  const paragraphs = locale === "ta" ? page.bodyTamil : page.bodyEnglish;
  return (
    <article className="narrow-page legal-page">
      <SectionHeading as="h1" title={locale === "ta" ? page.titleTamil : page.titleEnglish} />
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p>{site.legalName}</p>
    </article>
  );
}
