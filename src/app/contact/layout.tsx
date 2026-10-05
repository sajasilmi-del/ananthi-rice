import type { Metadata } from "next";
import { site } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { metaDescription, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const delivery = locale === "ta" ? site.freeDeliveryTamil : site.freeDeliveryEnglish;
  return pageMetadata({
    locale,
    title: t(locale, "contact.title"),
    description: metaDescription(`${t(locale, "contact.title")}. ${site.legalName}. ${delivery}`),
    path: "/contact",
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
