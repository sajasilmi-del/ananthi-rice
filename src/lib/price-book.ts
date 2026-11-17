import { unitPrice } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

export type PriceBook = {
  updatedAt: string;
  prices: Record<string, number | null>;
};

export type AdminVariant = {
  id: string;
  packEnglish: string;
  packTamil: string;
  price: number | null;
};

export type AdminProductRow = {
  id: string;
  nameEnglish: string;
  nameTamil: string;
  categoryId: string;
  categoryEnglish: string;
  categoryTamil: string;
  variants: AdminVariant[];
};

export const emptyPriceBook: PriceBook = { updatedAt: "", prices: {} };

const MAX_PRICE = 1_000_000;

export function priceKey(productId: string, variantId: string): string {
  return `${productId}/${variantId}`;
}

export function isMoney(value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) return false;
  const paise = Math.round(value * 100);
  return Math.abs(value * 100 - paise) < 1e-6;
}

export function parsePriceBook(value: unknown): PriceBook | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { updatedAt?: unknown; prices?: unknown };
  if (!record.prices || typeof record.prices !== "object" || Array.isArray(record.prices)) return null;
  const prices: Record<string, number | null> = {};
  for (const [key, price] of Object.entries(record.prices)) {
    if (!key.includes("/")) continue;
    if (price === null) prices[key] = null;
    else if (typeof price === "number" && isMoney(price)) prices[key] = price;
  }
  return {
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    prices,
  };
}

export function applyPriceBook(source: Product[], book: PriceBook | null | undefined): Product[] {
  if (!book || Object.keys(book.prices).length === 0) return source;
  let any = false;
  const next = source.map((product) => {
    let changed = false;
    const variants = product.variants.map((variant) => {
      const key = priceKey(product.id, variant.id);
      if (!Object.prototype.hasOwnProperty.call(book.prices, key)) return variant;
      changed = true;
      return { ...variant, price: book.prices[key], salePrice: null };
    });
    if (!changed) return product;
    any = true;
    return { ...product, variants };
  });
  return any ? next : source;
}

export function adminProductRows(catalog: Product[], categoryList: Category[]): AdminProductRow[] {
  const categoriesById = new Map(categoryList.map((category) => [category.id, category]));
  return catalog
    .filter((product) => product.active)
    .map((product) => {
      const category = categoriesById.get(product.category);
      return {
        id: product.id,
        nameEnglish: product.nameEnglish,
        nameTamil: product.nameTamil,
        categoryId: product.category,
        categoryEnglish: category?.nameEnglish ?? product.category,
        categoryTamil: category?.nameTamil ?? product.category,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          packEnglish: variant.packSize ?? variant.id,
          packTamil: variant.packSizeTamil ?? variant.packSize ?? variant.id,
          price: unitPrice(variant),
        })),
      };
    });
}

export function validatePriceDraft(
  body: unknown,
  catalog: Product[],
): { ok: true; updates: Record<string, number | null> } | { ok: false; error: "invalid" } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid" };
  const prices = (body as { prices?: unknown }).prices;
  if (!Array.isArray(prices)) return { ok: false, error: "invalid" };
  const allowed = new Set<string>();
  for (const product of catalog) {
    if (!product.active) continue;
    for (const variant of product.variants) allowed.add(priceKey(product.id, variant.id));
  }
  const updates: Record<string, number | null> = {};
  for (const entry of prices) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "invalid" };
    const record = entry as { productId?: unknown; variantId?: unknown; price?: unknown };
    if (typeof record.productId !== "string" || typeof record.variantId !== "string") return { ok: false, error: "invalid" };
    const key = priceKey(record.productId, record.variantId);
    if (!allowed.has(key) || Object.prototype.hasOwnProperty.call(updates, key)) return { ok: false, error: "invalid" };
    if (record.price === null) {
      updates[key] = null;
      continue;
    }
    if (typeof record.price !== "number" || !isMoney(record.price)) return { ok: false, error: "invalid" };
    updates[key] = record.price;
  }
  if (Object.keys(updates).length !== allowed.size) return { ok: false, error: "invalid" };
  return { ok: true, updates };
}

export function mergePriceBook(current: PriceBook, updates: Record<string, number | null>, updatedAt: string): PriceBook {
  return { updatedAt, prices: { ...current.prices, ...updates } };
}
