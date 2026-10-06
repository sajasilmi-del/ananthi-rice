import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categories, getProduct, products, relatedProducts } from "@/lib/catalog";
import { isProductSlug, productPageMeta, productPath } from "@/lib/product-page";

const samples = [
  "ponni-boiled-rice",
  "seeraga-samba-rice",
  "karuppu-kavuni-rice",
  "hand-pounded-ponni-boiled-rice",
  "ragi-sevai",
  "thinai",
  "rice-flour",
];

describe("product detail pages", () => {
  it("gives every product an SEO slug URL", () => {
    expect(new Set(products.map((product) => product.id)).size).toBe(products.length);
    for (const product of products) {
      expect(isProductSlug(product.id)).toBe(true);
      expect(productPath(product.id)).toBe(`/products/${product.id}`);
    }
    expect(productPath("ponni-boiled-rice")).toBe("/products/ponni-boiled-rice");
    expect(productPath("seeraga-samba-rice")).toBe("/products/seeraga-samba-rice");
    expect(productPath("karuppu-kavuni-rice")).toBe("/products/karuppu-kavuni-rice");
  });

  it("builds a title and description from the product record", () => {
    for (const id of samples) {
      const product = getProduct(id);
      expect(product).toBeDefined();
      const meta = productPageMeta(product!);
      expect(meta.title).toBe(`${product!.nameEnglish} | ANANTHI RICE`);
      expect(meta.description.startsWith(`${product!.nameTamil}. `)).toBe(true);
      expect(meta.description).toContain(product!.descriptionEnglish);
      expect(meta.path).toBe(`/products/${id}`);
      expect(meta.description).not.toMatch(/₹|rs\.?\s*\d/i);
    }
  });

  it("keeps related products in the same category and covers every product type", () => {
    for (const product of products) {
      const related = relatedProducts(product);
      expect(related.length).toBeGreaterThan(0);
      expect(related.length).toBeLessThanOrEqual(4);
      expect(related.every((item) => item.category === product.category && item.id !== product.id)).toBe(true);
      expect(product.variants.map((variant) => variant.packSize)).toEqual(["1 kg", "5 kg", "10 kg", "26 kg"]);
    }
    expect(categories.map((category) => category.id).sort()).toEqual(
      [...new Set(products.map((product) => product.category))].sort(),
    );
  });

  it("renders product pages from the dynamic route and catalog data", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "app", "products", "[id]", "page.tsx"), "utf8");
    expect(source).toContain("generateStaticParams");
    expect(source).toContain("generateMetadata");
    expect(source).toContain("productPageMeta");
    expect(source).not.toContain("Ponni Boiled");
    expect(source).not.toContain("919942034428");
  });
});
