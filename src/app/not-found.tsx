import type { Metadata } from "next";
import { NotFoundView } from "@/components/NotFoundView";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  return pageMetadata({
    locale,
    title: t(locale, "errors.notFoundTitle"),
    description: t(locale, "errors.notFoundBody"),
    path: "/",
    includeAlternates: false,
  });
}

export default function NotFound() {
  return <NotFoundView />;
}
