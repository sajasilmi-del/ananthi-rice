"use client";

import Link from "next/link";
import { brandName, brands, productName, visibleProducts } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { productPath } from "@/lib/product-page";
import { useLanguage } from "@/components/Providers";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function BrandsPage() {
  const { locale } = useLanguage();
  const ordered = [...brands].sort((a, b) => (a.role === b.role ? 0 : a.role === "main" ? -1 : 1));
  return (
    <div className="stack brand-page">
      <header className="shop-head">
        <SectionHeading as="h1" title={t(locale, "brands.title")} />
        <p className="lede">{t(locale, "home.brandsLead")}</p>
      </header>
      <div className="brand-page-list">
        {ordered.map((brand) => {
          const items = visibleProducts().filter((product) => product.brand === brand.id);
          return (
            <article key={brand.id} className="brand-card brand-page-card" data-testid={`brand-${brand.id}`} data-role={brand.role} data-brand={brand.id}>
              <div className="brand-logo">
                <CatalogImage src={brand.logo} alt={brandName(brand, locale)} width={280} height={160} sizes="220px" />
              </div>
              <div className="brand-page-copy">
                <Badge tone={brand.role === "main" ? "main" : brand.id}>{brand.role === "main" ? t(locale, "brands.main") : t(locale, "brands.sub")}</Badge>
                <h2>{locale === "ta" ? brand.nameTamil : brand.nameEnglish}</h2>
                <p className="brand-tagline">{brand.taglineEnglish}</p>
                <p>{locale === "ta" ? brand.descriptionTamil : brand.descriptionEnglish}</p>
                <ButtonLink href={`/products?brand=${brand.id}`}>
                  {t(locale, "home.brandProducts")} ({items.length})
                </ButtonLink>
              </div>
              <div className="brand-page-media">
                {items.slice(0, 3).map((product) => (
                  <Link key={product.id} href={productPath(product.id)}>
                    <CatalogImage src={product.images[0] ?? ""} alt={productName(product, locale)} width={135} height={165} sizes="140px" />
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
