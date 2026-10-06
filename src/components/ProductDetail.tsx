"use client";

import Link from "next/link";
import { ProductPurchase } from "@/components/ProductPurchase";
import { useLanguage } from "@/components/Providers";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getCategory, productName } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { productPath } from "@/lib/product-page";
import type { Product } from "@/lib/types";

export function ProductDetail({ product, related }: { product: Product; related: Product[] }) {
  const { locale } = useLanguage();
  const category = getCategory(product.category);
  const categoryName = category ? (locale === "ta" ? category.nameTamil : category.nameEnglish) : "";

  return (
    <div className="product-detail stack">
      <nav className="breadcrumb" aria-label={t(locale, "products.breadcrumb")} data-testid="product-breadcrumb">
        <ol>
          <li>
            <Link href="/">{t(locale, "nav.home")}</Link>
          </li>
          <li>
            <Link href="/products">{t(locale, "nav.products")}</Link>
          </li>
          {category ? (
            <li>
              <Link href={`/products?category=${category.id}`}>{categoryName}</Link>
            </li>
          ) : null}
          <li>
            <span aria-current="page">{productName(product, locale)}</span>
          </li>
        </ol>
      </nav>
      <ProductPurchase key={product.id} product={product} detail />
      <section className="detail-delivery">
        <p className="muted" data-testid="delivery-note">{t(locale, "delivery.checkoutNote")}</p>
      </section>
      <section className="stack related" data-testid="related-products">
        <SectionHeading title={t(locale, "products.related")} />
        {related.length === 0 ? <p>{t(locale, "products.noRelated")}</p> : null}
        <div className="related-grid">
          {related.map((item) => {
            const name = productName(item, locale);
            const altName = locale === "ta" ? item.nameEnglish : item.nameTamil;
            return (
              <Link key={item.id} className="related-card" href={productPath(item.id)} data-testid={`related-${item.id}`}>
                <span className="related-media" aria-hidden="true">
                  <CatalogImage src={item.images[0] ?? ""} alt={name} width={180} height={220} sizes="(max-width: 767px) 42vw, 200px" />
                </span>
                <span className="related-name">{name}</span>
                <span className="note">{altName}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
