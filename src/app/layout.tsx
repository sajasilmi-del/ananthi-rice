import type { Metadata } from "next";
import { Fraunces, Noto_Sans_Tamil, Noto_Serif_Tamil, Outfit } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { Providers } from "@/components/Providers";
import { site } from "@/lib/catalog";
import { requestLocale, requestPath } from "@/lib/request-locale";
import { absoluteUrl, localePath, pageMetadata, siteDescription, siteJsonLd, siteOrigin } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display",
});

const displayTamil = Noto_Serif_Tamil({
  subsets: ["tamil"],
  weight: "variable",
  display: "swap",
  preload: false,
  variable: "--font-display-tamil",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans",
});

const sansTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: "variable",
  display: "swap",
  variable: "--font-sans-tamil",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const description = siteDescription(locale);
  const meta = pageMetadata({
    locale,
    title: site.brandName,
    description,
    path: "/",
    absoluteTitle: true,
  });
  return {
    ...meta,
    metadataBase: new URL(siteOrigin()),
    title: {
      default: site.brandName,
      template: `%s | ${site.brandName}`,
    },
  };
}

function HomeLocaleLinks({ locale }: { locale: Locale }) {
  const canonical = absoluteUrl(localePath("/", locale));
  return (
    <head>
      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en" href={absoluteUrl("/")} />
      <link rel="alternate" hrefLang="ta" href={absoluteUrl("/?lang=ta")} />
      <link rel="alternate" hrefLang="x-default" href={absoluteUrl("/")} />
      <meta property="og:url" content={canonical} />
    </head>
  );
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await requestLocale();
  const path = await requestPath();
  const isHome = path === "/" || path.startsWith("/?");
  return (
    <html lang={locale} className={`${display.variable} ${displayTamil.variable} ${sans.variable} ${sansTamil.variable}`}>
      {isHome ? <HomeLocaleLinks locale={locale} /> : null}
      <body>
        <JsonLd data={siteJsonLd(locale)} />
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
