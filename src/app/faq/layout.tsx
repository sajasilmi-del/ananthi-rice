import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { pageMetadata, siteDescription } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return pageMetadata({
    locale,
    title: t(locale, "faq.title"),
    description: siteDescription(locale),
    path: "/faq",
  });
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
