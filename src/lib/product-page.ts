import { site } from "@/lib/catalog";
import type { Locale, Product } from "@/lib/types";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isProductSlug(id: string): boolean {
  return slugPattern.test(id);
}

export function productPath(id: string): string {
  return `/products/${id}`;
}

export function productPageMeta(product: Product, locale: Locale = "en"): { title: string; description: string; path: string } {
  const name = locale === "ta" ? product.nameTamil : product.nameEnglish;
  const alternate = locale === "ta" ? product.nameEnglish : product.nameTamil;
  const description = locale === "ta" ? product.descriptionTamil : product.descriptionEnglish;
  return {
    title: `${name} | ${site.brandName}`,
    description: `${alternate}. ${description}`,
    path: productPath(product.id),
  };
}
