import { isPurchasable, unitPrice } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

export type PriceBook = {
  updatedAt: string;
  prices: Record<string, number | null>;
  stock: Record<string, boolean>;
};

export type AdminVariant = {
  id: string;
  packEnglish: string;
  packTamil: string;
  price: number | null;
  inStock: boolean;
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

export const emptyPriceBook: PriceBook = { updatedAt: "", prices: {}, stock: {} };

const MAX_PRICE = 1_000_000;

export function priceKey(productId: string, variantId: string): string {
  return `${productId}/${variantId}`;
}

export function isMoney(value: number): boolean {
  if (!Number.isFinite(value) || value < 0 || value > MAX_PRICE) return false;
  const paise = Math.round(value * 100);
  return Math.abs(value * 100 - paise) < 1e-6;
}

function readMap(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parsePriceBook(value: unknown): PriceBook | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as { updatedAt?: unknown; prices?: unknown; stock?: unknown };
  const priceMap = readMap(record.prices);
  if (!priceMap) return null;
  const prices: Record<string, number | null> = {};
  for (const [key, price] of Object.entries(priceMap)) {
    if (!key.includes("/")) continue;
    if (price === null) prices[key] = null;
    else if (typeof price === "number" && isMoney(price)) prices[key] = price;
  }
  const stock: Record<string, boolean> = {};
  const stockMap = readMap(record.stock);
  if (stockMap) {
    for (const [key, inStock] of Object.entries(stockMap)) {
      if (!key.includes("/") || typeof inStock !== "boolean") continue;
      stock[key] = inStock;
    }
  }
  return {
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    prices,
    stock,
  };
}

export function applyPriceBook(source: Product[], book: PriceBook | null | undefined): Product[] {
  const prices = book?.prices ?? {};
  const stock = book?.stock ?? {};
  if (Object.keys(prices).length === 0 && Object.keys(stock).length === 0) return source;
  let any = false;
  const next = source.map((product) => {
    let changed = false;
    const variants = product.variants.map((variant) => {
      const key = priceKey(product.id, variant.id);
      let nextVariant = variant;
      if (Object.prototype.hasOwnProperty.call(prices, key)) {
        nextVariant = { ...nextVariant, price: prices[key], salePrice: null };
        changed = true;
      }
      if (typeof stock[key] === "boolean") {
        const inStock = stock[key];
        nextVariant = {
          ...nextVariant,
          forSale: inStock,
          stock: inStock && (nextVariant.stock == null || nextVariant.stock < 1) ? null : nextVariant.stock,
        };
        changed = true;
      }
      return nextVariant;
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
          inStock: isPurchasable(product, variant),
        })),
      };
    });
}

function allowedKeys(catalog: Product[]): Set<string> {
  const allowed = new Set<string>();
  for (const product of catalog) {
    if (!product.active) continue;
    for (const variant of product.variants) allowed.add(priceKey(product.id, variant.id));
  }
  return allowed;
}

export function validatePriceDraft(
  body: unknown,
  catalog: Product[],
): { ok: true; updates: Record<string, number | null>; stock: Record<string, boolean> } | { ok: false; error: "invalid" } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid" };
  const record = body as { prices?: unknown; stock?: unknown };
  if (!Array.isArray(record.prices) || !Array.isArray(record.stock)) return { ok: false, error: "invalid" };
  const allowed = allowedKeys(catalog);
  const updates: Record<string, number | null> = {};
  for (const entry of record.prices) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "invalid" };
    const item = entry as { productId?: unknown; variantId?: unknown; price?: unknown };
    if (typeof item.productId !== "string" || typeof item.variantId !== "string") return { ok: false, error: "invalid" };
    const key = priceKey(item.productId, item.variantId);
    if (!allowed.has(key) || Object.prototype.hasOwnProperty.call(updates, key)) return { ok: false, error: "invalid" };
    if (item.price === null) {
      updates[key] = null;
      continue;
    }
    if (typeof item.price !== "number" || !isMoney(item.price)) return { ok: false, error: "invalid" };
    updates[key] = item.price;
  }
  const stock: Record<string, boolean> = {};
  for (const entry of record.stock) {
    if (!entry || typeof entry !== "object") return { ok: false, error: "invalid" };
    const item = entry as { productId?: unknown; variantId?: unknown; inStock?: unknown };
    if (typeof item.productId !== "string" || typeof item.variantId !== "string" || typeof item.inStock !== "boolean") {
      return { ok: false, error: "invalid" };
    }
    const key = priceKey(item.productId, item.variantId);
    if (!allowed.has(key) || Object.prototype.hasOwnProperty.call(stock, key)) return { ok: false, error: "invalid" };
    stock[key] = item.inStock;
  }
  if (Object.keys(updates).length !== allowed.size || Object.keys(stock).length !== allowed.size) return { ok: false, error: "invalid" };
  return { ok: true, updates, stock };
}

export function mergePriceBook(
  current: PriceBook,
  updates: Record<string, number | null>,
  stock: Record<string, boolean>,
  updatedAt: string,
): PriceBook {
  return {
    updatedAt,
    prices: { ...current.prices, ...updates },
    stock: { ...current.stock, ...stock },
  };
}
