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
import { products, publishCatalog } from "@/lib/catalog";
import { applyPriceBook, validatePriceDraft } from "@/lib/price-book";
import { readPriceBookFile, writePriceBookFile } from "@/lib/price-store";
import { priceStorageMode } from "@/lib/price-store-mode";

afterEach(() => {
  publishCatalog(null);
  clearLoginFailures();
});

function fullDraft(priceFor?: { productId: string; variantId: string; price: number | null }) {
  return {
    prices: products
      .filter((product) => product.active)
      .flatMap((product) =>
        product.variants.map((variant) => ({
          productId: product.id,
          variantId: variant.id,
          price:
            priceFor && product.id === priceFor.productId && variant.id === priceFor.variantId
              ? priceFor.price
              : variant.price,
        })),
      ),
  };
}

describe("admin prices", () => {
  it("replaces only the saved pack price used at checkout", () => {
    const draft = validatePriceDraft(fullDraft({ productId: "ponni-boiled-rice", variantId: "1kg", price: 161 }), products);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    publishCatalog(applyPriceBook(products, { updatedAt: "2026-11-17T00:00:00.000Z", prices: draft.updates }));
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 2 })).toBe(322);
    expect(lineAmount({ productId: "ponni-boiled-rice", variantId: "5kg", quantity: 1 })).toBe(799);
  });

  it("rejects a partial list, text, and extra decimal places", () => {
    expect(validatePriceDraft({ prices: [{ productId: "ponni-boiled-rice", variantId: "1kg", price: 10 }] }, products).ok).toBe(false);
    const bad = fullDraft({ productId: "ponni-boiled-rice", variantId: "1kg", price: 10 });
    bad.prices[0].price = 10.555 as unknown as number;
    expect(validatePriceDraft(bad, products).ok).toBe(false);
  });

  it("stores and reads a price book file", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ananthi-prices-"));
    const file = path.join(dir, "price-book.json");
    writePriceBookFile(file, { updatedAt: "today", prices: { "ponni-boiled-rice/1kg": 170 } });
    expect(readPriceBookFile(file).prices["ponni-boiled-rice/1kg"]).toBe(170);
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
