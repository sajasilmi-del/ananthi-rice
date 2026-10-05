import type { Metadata } from "next";
import { getBrand, getCategory, locations, site, unitPrice } from "@/lib/catalog";
import { productPageMeta } from "@/lib/product-page";
import type { Locale, Product } from "@/lib/types";

export function siteOrigin(): string {
  return `https://${site.website}`;
}

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalized}`;
}

export function localePath(path: string, locale: Locale): string {
  const url = new URL(path, siteOrigin());
  if (locale === "ta") url.searchParams.set("lang", "ta");
  else url.searchParams.delete("lang");
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const sentence = slice.lastIndexOf(". ");
  if (sentence >= 80) return slice.slice(0, sentence + 1);
  const space = slice.lastIndexOf(" ");
  const end = space >= 80 ? space : max;
  return `${slice.slice(0, end).trim()}…`;
}

export function siteDescription(locale: Locale): string {
  const hero = locale === "ta" ? site.heroTamil : site.heroEnglish;
  const tagline = locale === "ta" ? site.taglineTamil : site.taglineEnglish;
  return metaDescription(`${hero} ${tagline}`);
}

export function pageMetadata(options: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  index?: boolean;
  absoluteTitle?: boolean;
  includeAlternates?: boolean;
  image?: string;
  imageAlt?: string;
}): Metadata {
  const { locale, title, description, path, index = true, absoluteTitle = false, includeAlternates = true, image, imageAlt } = options;
  if (!includeAlternates) {
    return {
      title: absoluteTitle ? { absolute: title } : title,
      description,
      robots: { index: false, follow: false },
    };
  }
  const canonical = localePath(path, locale);
  const logo = getBrand("ananthi")?.logo;
  const imagePath = image ?? logo;
  const imageUrl = imagePath ? absoluteUrl(imagePath) : undefined;
  const languages = {
    en: localePath(path, "en"),
    ta: localePath(path, "ta"),
    "x-default": localePath(path, "en"),
  };
  // Next.js drops a query string when the resolved pathname is exactly "/".
  // The root layout prints those homepage links itself.
  const homepage = new URL(canonical, siteOrigin()).pathname === "/";
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: homepage ? undefined : { canonical, languages },
    openGraph: {
      type: "website",
      ...(homepage ? {} : { url: absoluteUrl(canonical) }),
      title,
      description,
      siteName: site.brandName,
      locale: locale === "ta" ? "ta_IN" : "en_IN",
      alternateLocale: locale === "ta" ? ["en_IN"] : ["ta_IN"],
      images: imageUrl ? [{ url: imageUrl, alt: imageAlt ?? site.brandName }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function addressLines(locale: Locale): string[] {
  const head = locations.find((location) => location.role === "head_office_direct_sales") ?? locations[0];
  if (!head) return [];
  return locale === "ta" ? head.addressTamil : head.addressEnglish;
}

export function siteJsonLd(locale: Locale): Record<string, unknown> {
  const logo = getBrand("ananthi")?.logo;
  const lines = addressLines(locale);
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    name: site.brandName,
    legalName: site.legalName,
    url: siteOrigin(),
    email: site.email,
    telephone: site.phones,
  };
  if (logo) organization.logo = absoluteUrl(logo);
  if (lines.length > 0) {
    organization.address = {
      "@type": "PostalAddress",
      streetAddress: lines.join(", "),
    };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        name: site.brandName,
        url: siteOrigin(),
        inLanguage: ["en-IN", "ta-IN"],
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteOrigin()}/products?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function productJsonLd(product: Product, locale: Locale): Record<string, unknown> {
  const meta = productPageMeta(product, locale);
  const brand = getBrand(product.brand);
  const category = getCategory(product.category);
  const image = product.images[0] ? absoluteUrl(product.images[0]) : undefined;
  const offers = product.variants.flatMap((variant) => {
    const price = unitPrice(variant);
    if (price == null) return [];
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      priceCurrency: "INR",
      price,
      url: absoluteUrl(localePath(meta.path, locale)),
    };
    if (variant.stock === 0) offer.availability = "https://schema.org/OutOfStock";
    else if (variant.stock != null && variant.stock > 0) offer.availability = "https://schema.org/InStock";
    return [offer];
  });
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: locale === "ta" ? product.nameTamil : product.nameEnglish,
    description: meta.description,
    sku: product.id,
    url: absoluteUrl(localePath(meta.path, locale)),
    inLanguage: locale === "ta" ? "ta-IN" : "en-IN",
  };
  if (image) data.image = image;
  if (brand) {
    data.brand = {
      "@type": "Brand",
      name: locale === "ta" ? brand.nameTamil : brand.nameEnglish,
    };
  }
  if (category) data.category = locale === "ta" ? category.nameTamil : category.nameEnglish;
  if (offers.length === 1) data.offers = offers[0];
  else if (offers.length > 1) data.offers = offers;
  return data;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[], locale: Locale): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(localePath(item.path, locale)),
    })),
  };
}
