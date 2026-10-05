import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { pageMetadata, siteDescription } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return pageMetadata({
    locale,
    title: t(locale, "checkout.title"),
    description: siteDescription(locale),
    path: "/checkout",
    index: false,
  });
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
