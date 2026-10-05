import { brands, categories, getBrand, productName, unitPrice, visibleProducts } from "@/lib/catalog";
import type { Locale, Product, Variant } from "@/lib/types";

export const SHOP_PAGE_SIZE = 12;

export const shopSorts = ["featured", "name-asc", "name-desc", "price-asc", "price-desc"] as const;
export type ShopSort = (typeof shopSorts)[number];

export type ShopQuery = {
  category?: string | null;
  brand?: string | null;
  q?: string | null;
  sort?: string | null;
  page?: string | number | null;
};

export type ShopResult = {
  items: Product[];
  matches: Product[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
  category: string | null;
  brand: string | null;
  q: string;
  sort: ShopSort;
};

const categoryIds = new Set(categories.map((category) => category.id));
const brandIds = new Set(brands.map((brand) => brand.id));

export function parseShopSort(value: string | null | undefined): ShopSort {
  return shopSorts.includes(value as ShopSort) ? (value as ShopSort) : "featured";
}

export function productSortPrice(product: Product): number | null {
  const prices = product.variants.map(unitPrice).filter((price): price is number => price != null);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function displayPrice(variant: Variant): { current: number | null; original: number | null } {
  const current = unitPrice(variant);
  const original =
    variant.salePrice != null && variant.price != null && variant.price !== variant.salePrice ? variant.price : null;
  return { current, original };
}

export function formatInr(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ta" ? "ta-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function brandFitsCategory(
  brand: string | null | undefined,
  category: string | null | undefined,
  source: Product[] = visibleProducts(),
): boolean {
  if (!brand || !category) return true;
  return source.some((product) => product.active && product.brand === brand && product.category === category);
}

export function shopPath(input: {
  category?: string | null;
  brand?: string | null;
  q?: string | null;
  sort?: ShopSort | null;
  page?: number | null;
}): string {
  const params = new URLSearchParams();
  if (input.category) params.set("category", input.category);
  if (input.brand) params.set("brand", input.brand);
  const q = input.q?.trim();
  if (q) params.set("q", q);
  if (input.sort && input.sort !== "featured") params.set("sort", input.sort);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parsePage(value: string | number | null | undefined): number {
  const page = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}

function matchesQuery(product: Product, query: string): boolean {
  if (!query) return true;
  const brand = getBrand(product.brand);
  const haystack = normalize(
    [
      product.nameEnglish,
      product.nameTamil,
      product.descriptionEnglish,
      product.descriptionTamil,
      brand?.nameEnglish ?? "",
      brand?.nameTamil ?? "",
    ].join(" "),
  );
  return haystack.includes(query);
}

function sortProducts(items: Product[], sort: ShopSort, locale: Locale): Product[] {
  const copy = [...items];
  if (sort === "featured") {
    return copy.sort((left, right) => Number(right.featured) - Number(left.featured));
  }
  if (sort === "name-asc" || sort === "name-desc") {
    const direction = sort === "name-asc" ? 1 : -1;
    const language = locale === "ta" ? "ta" : "en";
    return copy.sort((left, right) => productName(left, locale).localeCompare(productName(right, locale), language) * direction);
  }
  return copy.sort((left, right) => {
    const leftPrice = productSortPrice(left);
    const rightPrice = productSortPrice(right);
    if (leftPrice == null && rightPrice == null) return 0;
    if (leftPrice == null) return 1;
    if (rightPrice == null) return -1;
    return sort === "price-asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
  });
}

export function queryProducts(input: ShopQuery = {}, source: Product[] = visibleProducts(), locale: Locale = "en"): ShopResult {
  const category = input.category && categoryIds.has(input.category as (typeof categories)[number]["id"]) ? input.category : null;
  const brand = input.brand && brandIds.has(input.brand as (typeof brands)[number]["id"]) ? input.brand : null;
  const q = normalize(input.q ?? "");
  const sort = parseShopSort(input.sort);
  let matches = source.filter((product) => product.active);
  if (category) matches = matches.filter((product) => product.category === category);
  if (brand) matches = matches.filter((product) => product.brand === brand);
  if (q) matches = matches.filter((product) => matchesQuery(product, q));
  matches = sortProducts(matches, sort, locale);

  const total = matches.length;
  const pageCount = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE));
  const page = Math.min(parsePage(input.page), pageCount);
  const start = (page - 1) * SHOP_PAGE_SIZE;
  return {
    items: matches.slice(start, start + SHOP_PAGE_SIZE),
    matches,
    total,
    page,
    pageCount,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + SHOP_PAGE_SIZE, total),
    category,
    brand,
    q,
    sort,
  };
}
