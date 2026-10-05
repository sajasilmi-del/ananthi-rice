"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { brands, categories, getCategory, visibleProducts } from "@/lib/catalog";
import { formatMessage, t } from "@/lib/i18n";
import { brandFitsCategory, parseShopSort, queryProducts, shopPath, type ShopSort } from "@/lib/shop";
import { ProductPurchase } from "@/components/ProductPurchase";
import { useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ProductList() {
  const { locale } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const qParam = params.get("q") ?? "";
  const [draft, setDraft] = useState(qParam);
  useEffect(() => {
    setDraft(qParam);
  }, [qParam]);

  const requestedCategory = params.get("category");
  const requestedBrand = params.get("brand");
  const brandHidesCategory =
    !qParam.trim() &&
    Boolean(requestedCategory && requestedBrand) &&
    !brandFitsCategory(requestedBrand, requestedCategory) &&
    queryProducts({ category: requestedCategory }).total > 0;
  const result = queryProducts(
    {
      category: requestedCategory,
      brand: brandHidesCategory ? null : requestedBrand,
      q: qParam,
      sort: params.get("sort"),
      page: params.get("page"),
    },
    visibleProducts(),
    locale,
  );
  useEffect(() => {
    if (!brandHidesCategory || !requestedCategory) return;
    router.replace(
      shopPath({
        category: requestedCategory,
        q: qParam,
        sort: parseShopSort(params.get("sort")),
        page: Number(params.get("page") ?? 1),
      }),
    );
  }, [brandHidesCategory, params, qParam, requestedCategory, router]);
  const category = result.category ? getCategory(result.category) : undefined;
  const title = category ? (locale === "ta" ? category.nameTamil : category.nameEnglish) : t(locale, "products.shop");
  const filtered = Boolean(result.category || result.brand || result.q || result.sort !== "featured");

  function openShop(
    patch: { category?: string | null; brand?: string | null; q?: string; sort?: ShopSort; page?: number },
    resetPage = false,
  ) {
    router.push(
      shopPath({
        category: patch.category !== undefined ? patch.category : result.category,
        brand: patch.brand !== undefined ? patch.brand : result.brand,
        q: patch.q ?? result.q,
        sort: patch.sort ?? result.sort,
        page: resetPage ? 1 : (patch.page ?? result.page),
      }),
    );
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openShop({ q: draft.trim() }, true);
  }

  return (
    <div className="shop">
      <header className="shop-head">
        <SectionHeading as="h1" title={title} />
        {category ? <p className="lede">{locale === "ta" ? category.descriptionTamil : category.descriptionEnglish}</p> : null}
      </header>
      <nav className="shop-rail" aria-label={t(locale, "products.category")}>
        <Link className="chip" href={shopPath({ brand: result.brand, q: result.q, sort: result.sort })} aria-current={result.category ? undefined : "page"}>
          {t(locale, "products.allCategories")}
        </Link>
        {categories.map((item) => {
          const name = locale === "ta" ? item.nameTamil : item.nameEnglish;
          return (
            <Link
              key={item.id}
              className="chip"
              href={shopPath({
                category: item.id,
                brand: brandFitsCategory(result.brand, item.id) ? result.brand : null,
                q: result.q,
                sort: result.sort,
              })}
              aria-current={result.category === item.id ? "page" : undefined}
            >
              {name}
            </Link>
          );
        })}
      </nav>
      <form className="shop-toolbar" onSubmit={onSearch}>
        <div className="shop-search">
          <label className="sr-only" htmlFor="shop-search-input">
            {t(locale, "products.search")}
          </label>
          <svg className="icon shop-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            id="shop-search-input"
            type="search"
            data-testid="shop-search"
            value={draft}
            placeholder={t(locale, "products.searchPlaceholder")}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" data-testid="shop-submit">
            {t(locale, "products.searchSubmit")}
          </Button>
        </div>
        <div className="shop-filters">
          <select
            data-testid="shop-category"
            value={result.category ?? ""}
            aria-label={t(locale, "products.category")}
            onChange={(event) => {
              const category = event.target.value;
              openShop(
                {
                  category,
                  brand: brandFitsCategory(result.brand, category) ? result.brand : null,
                },
                true,
              );
            }}
          >
            <option value="">{t(locale, "products.allCategories")}</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {locale === "ta" ? item.nameTamil : item.nameEnglish}
              </option>
            ))}
          </select>
          <select
            data-testid="shop-brand"
            value={result.brand ?? ""}
            aria-label={t(locale, "products.brand")}
            onChange={(event) => {
              const brand = event.target.value;
              openShop(
                {
                  brand,
                  category: brandFitsCategory(brand, result.category) ? result.category : null,
                },
                true,
              );
            }}
          >
            <option value="">{t(locale, "products.allBrands")}</option>
            {brands.map((item) => (
              <option key={item.id} value={item.id}>
                {locale === "ta" ? item.nameTamil : item.nameEnglish}
              </option>
            ))}
          </select>
          <select
            data-testid="shop-sort"
            value={result.sort}
            aria-label={t(locale, "products.sort")}
            onChange={(event) => openShop({ sort: event.target.value as ShopSort }, true)}
          >
            <option value="featured">{t(locale, "products.sortFeatured")}</option>
            <option value="name-asc">{t(locale, "products.sortNameAsc")}</option>
            <option value="name-desc">{t(locale, "products.sortNameDesc")}</option>
            <option value="price-asc">{t(locale, "products.sortPriceAsc")}</option>
            <option value="price-desc">{t(locale, "products.sortPriceDesc")}</option>
          </select>
        </div>
      </form>
      <div className="shop-meta">
        <p data-testid="shop-count">
          {formatMessage(t(locale, "products.showing"), { from: result.from, to: result.to, total: result.total })}
        </p>
        {filtered && result.total > 0 ? (
          <Link className="chip" href="/products" data-testid="shop-clear">
            {t(locale, "products.clearFilters")}
          </Link>
        ) : null}
      </div>
      {result.total === 0 ? (
        <div className="shop-empty" data-testid="shop-empty">
          <h2>{t(locale, "products.noProducts")}</h2>
          <p>
            {result.q
              ? formatMessage(t(locale, "products.noResults"), { query: result.q })
              : t(locale, "products.noMatches")}
          </p>
          <Link className="btn btn-secondary" href="/products" data-testid="shop-clear">
            {t(locale, "products.clearFilters")}
          </Link>
        </div>
      ) : (
        <div className="grid shop-grid">
          {result.items.map((product) => (
            <ProductPurchase key={product.id} product={product} />
          ))}
        </div>
      )}
      {result.pageCount > 1 ? (
        <div className="shop-pager">
          <Button
            variant="secondary"
            data-testid="shop-prev"
            disabled={result.page <= 1}
            onClick={() => openShop({ page: result.page - 1 })}
          >
            {t(locale, "products.previous")}
          </Button>
          <p data-testid="shop-page">
            {formatMessage(t(locale, "products.pageStatus"), { page: result.page, count: result.pageCount })}
          </p>
          <Button
            variant="secondary"
            data-testid="shop-next"
            disabled={result.page >= result.pageCount}
            onClick={() => openShop({ page: result.page + 1 })}
          >
            {t(locale, "products.next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
