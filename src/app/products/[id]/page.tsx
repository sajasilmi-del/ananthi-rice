import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import { getCategory, getProduct, productName, products, relatedProducts } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { productPageMeta, productPath } from "@/lib/product-page";
import { requestLocale } from "@/lib/request-locale";
import { breadcrumbJsonLd, pageMetadata, productJsonLd } from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return products.filter((product) => product.active).map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  if (!product || !product.active) return {};
  const locale = await requestLocale();
  const meta = productPageMeta(product, locale);
  return pageMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    path: meta.path,
    absoluteTitle: true,
    image: product.images[0],
    imageAlt: productName(product, locale),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product || !product.active) notFound();
  const locale = await requestLocale();
  const category = getCategory(product.category);
  const crumbs = [
    { name: t(locale, "nav.home"), path: "/" },
    { name: t(locale, "nav.products"), path: "/products" },
    ...(category
      ? [{ name: locale === "ta" ? category.nameTamil : category.nameEnglish, path: `/products?category=${category.id}` }]
      : []),
    { name: productName(product, locale), path: productPath(product.id) },
  ];
  return (
    <>
      <JsonLd data={productJsonLd(product, locale)} />
      <JsonLd data={breadcrumbJsonLd(crumbs, locale)} />
      <ProductDetail product={product} related={relatedProducts(product)} />
    </>
  );
}
