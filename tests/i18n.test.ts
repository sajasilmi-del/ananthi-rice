import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categories, faq, legalPages, products } from "@/lib/catalog";
import { dictionaries, t } from "@/lib/i18n";
import { parseLocale } from "@/lib/language";
import { productPageMeta } from "@/lib/product-page";

const requiredKeys = [
  "nav.home",
  "nav.products",
  "home.shopCta",
  "home.categoryTitle",
  "home.deliveryTitle",
  "home.locationsTitle",
  "products.shop",
  "products.breadcrumb",
  "products.noProducts",
  "products.noResults",
  "cart.empty",
  "cart.title",
  "cart.viewCart",
  "cart.lineTotal",
  "cart.subtotal",
  "cart.deliveryFee",
  "cart.total",
  "cart.continueShopping",
  "cart.checkout",
  "account.signUp",
  "account.login",
  "account.profile",
  "account.profileSaved",
  "account.noSession",
  "account.saveFailed",
  "account.productionUnconfigured",
  "validation.nameShort",
  "validation.addressShort",
  "checkout.title",
  "checkout.empty",
  "checkout.requestSaved",
  "checkout.orderSummary",
  "checkout.confirmationTitle",
  "checkout.whatsappOrder",
  "checkout.recheck",
  "delivery.title",
  "delivery.saved",
  "validation.nameRequired",
  "validation.locationRequired",
  "errors.notFoundTitle",
  "errors.retry",
  "errors.originNotConfigured",
  "errors.locationInaccurate",
  "errors.network",
  "delivery.available",
  "delivery.unavailable",
  "delivery.distance",
  "delivery.lookup",
  "delivery.change",
  "faq.title",
  "footer.quickLinks",
  "footer.address",
  "whatsapp.intro",
  "whatsapp.intent",
  "whatsapp.customer",
  "whatsapp.deliveryAddress",
  "whatsapp.closing",
  "whatsapp.product",
  "header.tamilName",
  "header.englishName",
  "map.attribution",
  "contact.directions",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return [full];
  });
}

function visibleText(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const match of withoutComments.matchAll(/>([^<>{}]*)</g)) {
    if (withoutComments[match.index - 1] === "=") continue;
    const text = match[1].replace(/\s+/g, " ").trim();
    if (!/[A-Za-z\u0B80-\u0BFF]/.test(text)) continue;
    if (/[=;(){}]|const |return |use[A-Z]|import /.test(text)) continue;
    found.push(text);
  }
  return found;
}

describe("bilingual resources", () => {
  it("covers navigation, shop, account, checkout, delivery, and messages in both languages", () => {
    for (const key of requiredKeys) {
      expect(t("en", key).trim().length).toBeGreaterThan(0);
      expect(t("ta", key).trim().length).toBeGreaterThan(0);
    }
    expect(t("en", "header.tamilName")).toBe("தமிழ்");
    expect(t("ta", "header.tamilName")).toBe("தமிழ்");
    expect(t("en", "header.englishName")).toBe("English");
    expect(t("ta", "header.englishName")).toBe("English");
    expect(dictionaries.en.account.deviceNote).not.toBe(dictionaries.ta.account.deviceNote);
    const publicText = JSON.stringify({ en: dictionaries.en, ta: dictionaries.ta, legal: legalPages });
    expect(publicText).not.toMatch(/development build|development store|development adapter|டெவலப்மென்ட்/i);
  });

  it("keeps catalog content in Tamil and English instead of one language", () => {
    for (const category of categories) {
      expect(category.nameTamil.trim().length).toBeGreaterThan(0);
      expect(category.nameEnglish.trim().length).toBeGreaterThan(0);
    }
    for (const item of faq) {
      expect(item.questionTamil.trim().length).toBeGreaterThan(0);
      expect(item.questionEnglish.trim().length).toBeGreaterThan(0);
    }
    for (const page of legalPages) {
      expect(page.titleTamil.trim().length).toBeGreaterThan(0);
      expect(page.titleEnglish.trim().length).toBeGreaterThan(0);
    }
    const product = products[0];
    const tamil = productPageMeta(product, "ta");
    expect(tamil.title.startsWith(product.nameTamil)).toBe(true);
    expect(tamil.description).toContain(product.descriptionTamil);
  });

  it("reads only the stored language values", () => {
    expect(parseLocale("ta")).toBe("ta");
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("fr")).toBeNull();
    expect(parseLocale(undefined)).toBeNull();
  });

  it("does not leave visible English or Tamil sentences in the interface components", () => {
    const files = [...walk(path.join(process.cwd(), "src", "components")), ...walk(path.join(process.cwd(), "src", "app"))].filter((file) => file.endsWith(".tsx"));
    const leftovers = files.flatMap((file) => visibleText(readFileSync(file, "utf8")).map((text) => `${path.relative(process.cwd(), file)}: ${text}`));
    expect(leftovers).toEqual([]);
  });
});
