import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  createSessionToken,
  passwordMatches,
  readSessionToken,
  recordLoginFailure,
} from "@/lib/admin-auth";
import { lineAmount } from "@/lib/cart";
import { isPurchasable, products, publishCatalog } from "@/lib/catalog";
import { applyPriceBook, parsePriceBook, validatePriceDraft } from "@/lib/price-book";
import { readPriceBookFile, writePriceBookFile } from "@/lib/price-store";
import { priceStorageMode } from "@/lib/price-store-mode";

afterEach(() => {
  publishCatalog(null);
  clearLoginFailures();
});

function fullDraft(change?: { productId: string; variantId: string; price?: number | null; inStock?: boolean }) {
  const active = products.filter((product) => product.active);
  return {
    prices: active.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        variantId: variant.id,
        price:
          change && "price" in change && product.id === change.productId && variant.id === change.variantId
            ? change.price
            : variant.price,
      })),
    ),
    stock: active.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product.id,
        variantId: variant.id,
        inStock:
          change && "inStock" in change && product.id === change.productId && variant.id === change.variantId
            ? change.inStock
            : isPurchasable(product, variant),
      })),
    ),
  };
}

describe("admin prices", () => {
  it("replaces only the saved pack price used at checkout", () => {
    const draft = validatePriceDraft(fullDraft({ productId: "ponni-boiled-rice", variantId: "1kg", price: 161 }), products);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    publishCatalog(applyPriceBook(products, { updatedAt: "2026-11-17T00:00:00.000Z", prices: draft.updates, stock: draft.stock }));
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 2 })).toBe(322);
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "5kg", quantity: 1 })).toBe(799);
  });

  it("rejects a partial list, text, and extra decimal places", () => {
    expect(validatePriceDraft({ prices: [{ productId: "ponni-boiled-rice", variantId: "1kg", price: 10 }], stock: [] }, products).ok).toBe(false);
    const bad = fullDraft({ productId: "ponni-boiled-rice", variantId: "1kg", price: 10 });
    bad.prices[0].price = 10.555 as unknown as number;
    expect(validatePriceDraft(bad, products).ok).toBe(false);
    const noStock = fullDraft();
    noStock.stock = [];
    expect(validatePriceDraft(noStock, products).ok).toBe(false);
  });

  it("takes one pack out of stock and can put another brand on sale", () => {
    const hidden = validatePriceDraft(fullDraft({ productId: "ponni-boiled-rice", variantId: "1kg", inStock: false }), products);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    publishCatalog(applyPriceBook(products, { updatedAt: "2026-11-17T00:00:00.000Z", prices: hidden.updates, stock: hidden.stock }));
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 1 })).toBeNull();
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "5kg", quantity: 1 })).toBe(799);

    const opened = validatePriceDraft(fullDraft({ productId: "idli-rice", variantId: "1kg", inStock: true }), products);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    publishCatalog(applyPriceBook(products, { updatedAt: "2026-11-17T00:00:00.000Z", prices: opened.updates, stock: opened.stock }));
    expect(lineAmount({ productId: "idli-rice", variantId: "1kg", quantity: 2 })).toBe(280);
    expect(lineAmount({ productId: "idli-rice", variantId: "5kg", quantity: 1 })).toBeNull();
  });

  it("stores and reads a price book file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ananthi-prices-"));
    const file = path.join(dir, "price-book.json");
    writePriceBookFile(file, {
      updatedAt: "today",
      prices: { "ponni-boiled-rice/1kg": 170 },
      stock: { "ponni-boiled-rice/1kg": false },
    });
    expect(readPriceBookFile(file).prices["ponni-boiled-rice/1kg"]).toBe(170);
    expect(readPriceBookFile(file).stock["ponni-boiled-rice/1kg"]).toBe(false);
    expect(parsePriceBook({ updatedAt: "today", prices: { "ponni-boiled-rice/1kg": 170 } })?.stock).toEqual({});
    writeFileSync(file, "{");
    expect(readPriceBookFile(file).prices).toEqual({});
  });

  it("accepts the signed session and rejects a changed password", () => {
    const now = Date.parse("2026-11-17T00:00:00.000Z");
    const token = createSessionToken(now, "test-password");
    expect(readSessionToken(token, now + 1000, "test-password")).toBe(true);
    expect(readSessionToken(token, now + 1000, "other-password")).toBe(false);
    expect(readSessionToken(token, now + 13 * 60 * 60 * 1000, "test-password")).toBe(false);
    expect(passwordMatches("test-password", "test-password")).toBe(true);
    expect(passwordMatches("wrong", "test-password")).toBe(false);
  });

  it("locks the password after eight wrong tries", () => {
    for (let attempt = 0; attempt < 8; attempt += 1) expect(recordLoginFailure("shop")).toBe("ok");
    expect(recordLoginFailure("shop")).toBe("limited");
  });

  it("uses a file on a computer and blob only when a token exists", () => {
    expect(priceStorageMode({} as NodeJS.ProcessEnv)).toBe("file");
    expect(priceStorageMode({ VERCEL: "1" } as NodeJS.ProcessEnv)).toBe("unavailable");
    expect(priceStorageMode({ VERCEL: "1", BLOB_READ_WRITE_TOKEN: "token" } as NodeJS.ProcessEnv)).toBe("blob");
  });
});
