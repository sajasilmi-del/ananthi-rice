import type { Metadata } from "next";
import { site } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { metaDescription, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const about = locale === "ta" ? site.aboutTamil : site.aboutEnglish;
  return pageMetadata({
    locale,
    title: t(locale, "brands.title"),
    description: metaDescription(about),
    path: "/brands",
  });
}

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
