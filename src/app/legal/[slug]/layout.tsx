import type { Metadata } from "next";
import { legalPages } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { metaDescription, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const locale = await requestLocale();
  const page = legalPages.find((item) => item.id === slug);
  if (!page) {
    return pageMetadata({
      locale,
      title: t(locale, "errors.notFoundTitle"),
      description: t(locale, "errors.notFoundBody"),
      path: "/",
      includeAlternates: false,
    });
  }
  const title = locale === "ta" ? page.titleTamil : page.titleEnglish;
  const body = (locale === "ta" ? page.bodyTamil[0] : page.bodyEnglish[0]) ?? "";
  return pageMetadata({
    locale,
    title,
    description: metaDescription(`${title}. ${body}`),
    path: `/legal/${page.id}`,
  });
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
