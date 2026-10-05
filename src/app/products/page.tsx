import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductList } from "@/components/ProductList";
import { getBrand, getCategory } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { requestLocale } from "@/lib/request-locale";
import { metaDescription, pageMetadata, siteDescription } from "@/lib/seo";
import { shopPath } from "@/lib/shop";
import type { BrandId, CategoryId } from "@/lib/types";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const locale = await requestLocale();
  const category = getCategory((typeof params.category === "string" ? params.category : "") as CategoryId);
  const brand = getBrand((typeof params.brand === "string" ? params.brand : "") as BrandId);
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const sort = typeof params.sort === "string" ? params.sort : "";
  const pageValue = typeof params.page === "string" ? params.page : "";
  const categoryName = category ? (locale === "ta" ? category.nameTamil : category.nameEnglish) : "";
  const brandLabel = brand ? (locale === "ta" ? brand.nameTamil : brand.nameEnglish) : "";
  const title = [categoryName, brandLabel].filter(Boolean).join(" — ") || t(locale, "products.shop");
  const description = category
    ? metaDescription(locale === "ta" ? category.descriptionTamil : category.descriptionEnglish)
    : siteDescription(locale);
  const noisy = Boolean(q || (sort && sort !== "featured") || (pageValue && pageValue !== "1"));
  return pageMetadata({
    locale,
    title,
    description,
    path: shopPath({ category: category?.id, brand: brand?.id }),
    index: !noisy,
  });
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductList />
    </Suspense>
  );
}
