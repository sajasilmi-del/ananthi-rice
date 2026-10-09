import { readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brands, categories, locations, products } from "@/lib/catalog";
import { locationDirectionsUrl, locationEmbedUrl, mapViewCenter } from "@/lib/maps";
import { brandFitsCategory, displayPrice, formatInr, productSortPrice, queryProducts, shopPath, SHOP_PAGE_SIZE } from "@/lib/shop";
import type { Product, Variant } from "@/lib/types";

function priced(product: Product, variants: Variant[]): Product {
  return { ...product, variants };
}

describe("shop catalog", () => {
  it("opens the Chennai shop on the published Google listing", () => {
    const chennai = locations.find((location) => location.id === "chennai");
    const paramakudi = locations.find((location) => location.id === "paramakudi");
    expect(chennai).toMatchObject({ latitude: 13.0280447, longitude: 80.1868165, mapCid: "9659080878046730364" });
    expect(locationDirectionsUrl(chennai!)).toBe(
      "https://www.google.com/maps/place/Ananthi+Rice+Traders/@13.0281051,80.1866738,164m/data=!3m1!1e3!4m6!3m5!1s0x3a5261003db39c41:0x860bf2e1f0be587c!8m2!3d13.0280447!4d80.1868165!16s%2Fg%2F11p1kmn_v8!18m1!1e1",
    );
    expect(locationDirectionsUrl(chennai!)).not.toContain("maps/search");
    expect(locationEmbedUrl(chennai!, "en")).toBe(
      "https://maps.google.com/maps?cid=9659080878046730364&hl=en&z=17&output=embed",
    );
    expect(locationEmbedUrl(chennai!, "ta")).toContain("hl=ta");
    expect(paramakudi).toMatchObject({ latitude: 9.5505556, longitude: 78.58425 });
    expect(locationDirectionsUrl(paramakudi!)).toBe(
      "https://www.google.com/maps/place/9%C2%B033'02.0%22N+78%C2%B035'03.3%22E/@9.5505299,78.5842031,21z/data=!4m4!3m3!8m2!3d9.5505556!4d78.58425!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MTAwNi4wIKXMDSoASAFQAw%3D%3D",
    );
    expect(locationDirectionsUrl(paramakudi!)).not.toContain("maps/search");
    expect(locationEmbedUrl(paramakudi!, "en")).toBe(
      "https://maps.google.com/maps?q=9.5505556,78.58425&hl=en&z=17&output=embed",
    );
    expect(locationEmbedUrl(paramakudi!, "ta")).toContain("hl=ta");
    expect(mapViewCenter(null, { latitude: chennai!.latitude!, longitude: chennai!.longitude! })).toEqual({
      latitude: 13.0280447,
      longitude: 80.1868165,
      zoom: 15,
    });
    expect(mapViewCenter({ latitude: 9.5, longitude: 78.6 }, { latitude: 13, longitude: 80 })).toEqual({
      latitude: 9.5,
      longitude: 78.6,
      zoom: 12,
    });
  });

  it("maps every product to its own existing pack image", () => {
    const imageDir = realpathSync(path.join(process.cwd(), "public", "products"));
    expect(imageDir.toLowerCase()).toContain("rice_product_images");
    const files = new Set(readdirSync(imageDir).filter((name) => name.toLowerCase().endsWith(".png")));
    const referenced = products.flatMap((product) => product.images.map((image) => path.basename(image)));
    expect(referenced).toHaveLength(products.length);
    expect(new Set(referenced).size).toBe(referenced.length);
    for (const product of products) {
      expect(product.images.length).toBeGreaterThan(0);
      for (const image of product.images) {
        expect(files.has(path.basename(image))).toBe(true);
      }
    }
  });

  it("filters every category and brand and ignores unknown filters", () => {
    for (const category of categories) {
      const result = queryProducts({ category: category.id });
      const expected = products.filter((product) => product.category === category.id);
      expect(result.total).toBe(expected.length);
      expect(result.total).toBeGreaterThan(0);
      expect(result.matches.every((product) => product.category === category.id)).toBe(true);
    }
    for (const brand of brands) {
      const result = queryProducts({ brand: brand.id });
      const expected = products.filter((product) => product.brand === brand.id);
      expect(result.total).toBe(expected.length);
      expect(result.total).toBeGreaterThan(0);
      expect(result.matches.every((product) => product.brand === brand.id)).toBe(true);
    }
    expect(queryProducts({ category: "not-a-category", brand: "not-a-brand" }).total).toBe(products.length);
    expect(queryProducts({ category: "millets", brand: "ananthi" }).total).toBe(0);
    expect(queryProducts({ category: "millets", brand: "arthy" }).total).toBe(1);
    expect(queryProducts({ category: "millets", brand: "mahi" }).total).toBe(4);
    expect(brandFitsCategory("ananthi", "millets")).toBe(false);
    expect(brandFitsCategory("arthy", "millets")).toBe(true);
    expect(brandFitsCategory("ananthi", "flour")).toBe(true);
    expect(brandFitsCategory(null, "millets")).toBe(true);
  });

  it("searches English names, Tamil names, and empty queries", () => {
    for (const product of products) {
      expect(queryProducts({ q: product.nameEnglish }).matches.map((item) => item.id)).toContain(product.id);
      expect(queryProducts({ q: product.nameTamil }).matches.map((item) => item.id)).toContain(product.id);
    }
    expect(queryProducts({ q: "   " }).total).toBe(products.length);
    expect(queryProducts({ q: "not-a-real-product-xyz" }).total).toBe(0);
    expect(queryProducts({ q: "Basmati Rice", brand: "santosh" }).total).toBe(0);
    const samba = products.find((product) => product.id === "seeraga-samba-rice");
    expect(samba).toBeDefined();
    expect(queryProducts({ q: "சீரக சம்பா" }).matches.map((item) => item.id)).toContain(samba?.id);
  });

  it("sorts by featured flag, name, and price with unpriced products last", () => {
    const featured = queryProducts({ sort: "featured" });
    const featuredCount = products.filter((product) => product.featured).length;
    expect(featured.matches.slice(0, featuredCount).every((product) => product.featured)).toBe(true);
    expect(featured.matches.slice(featuredCount).every((product) => !product.featured)).toBe(true);

    const byEnglish = queryProducts({ sort: "name-asc" }).matches.map((product) => product.nameEnglish);
    expect([...byEnglish].sort((left, right) => left.localeCompare(right, "en"))).toEqual(byEnglish);
    const byTamil = queryProducts({ sort: "name-asc" }, products, "ta").matches.map((product) => product.nameTamil);
    expect([...byTamil].sort((left, right) => left.localeCompare(right, "ta"))).toEqual(byTamil);

    const [first, second, third] = products;
    const sample = [
      priced(first, [{ ...first.variants[0], price: 200, salePrice: null }]),
      priced(second, [
        { ...second.variants[0], price: 150, salePrice: 80 },
        { ...second.variants[0], id: "other", price: 90, salePrice: null },
      ]),
      priced(third, [{ ...third.variants[0], price: null, salePrice: null }]),
    ];
    expect(queryProducts({ sort: "price-asc" }, sample).matches.map((product) => product.id)).toEqual([
      second.id,
      first.id,
      third.id,
    ]);
    expect(queryProducts({ sort: "price-desc" }, sample).matches.map((product) => product.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
    expect(productSortPrice(sample[1])).toBe(80);
    expect(
      products.every((product) =>
        product.variants.every((variant) => typeof variant.price === "number" && variant.price > 0 && variant.salePrice == null),
      ),
    ).toBe(true);
  });

  it("paginates the full catalog and clamps the page", () => {
    const firstPage = queryProducts({});
    expect(SHOP_PAGE_SIZE).toBe(12);
    expect(firstPage.items).toHaveLength(12);
    expect(firstPage.total).toBe(49);
    expect(firstPage.pageCount).toBe(5);
    expect(firstPage.from).toBe(1);
    expect(firstPage.to).toBe(12);
    const secondPage = queryProducts({ page: 2 });
    expect(secondPage.items).toHaveLength(12);
    expect(secondPage.items.every((product) => !firstPage.items.some((item) => item.id === product.id))).toBe(true);
    const lastPage = queryProducts({ page: 99 });
    expect(lastPage.page).toBe(5);
    expect(lastPage.items).toHaveLength(1);
    expect(queryProducts({ page: 0 }).page).toBe(1);
    expect(queryProducts({ page: "abc" }).page).toBe(1);
    const narrow = queryProducts({ category: "flour", page: 50 });
    expect(narrow.page).toBe(narrow.pageCount);
    expect(narrow.items.length).toBeLessThanOrEqual(SHOP_PAGE_SIZE);
  });

  it("formats a configured price and leaves a null price for checkout", () => {
    const variant: Variant = {
      id: "1kg",
      packSize: "1 kg",
      packSizeTamil: "1 கிலோ",
      price: 120,
      salePrice: 99,
      stock: 4,
    };
    expect(displayPrice(variant)).toEqual({ current: 99, original: 120 });
    expect(displayPrice({ ...variant, salePrice: null })).toEqual({ current: 120, original: null });
    expect(displayPrice({ ...variant, price: null, salePrice: null })).toEqual({ current: null, original: null });
    expect(formatInr(99, "en")).toContain("99");
    expect(formatInr(99, "ta")).toContain("99");
    expect(shopPath({ category: "everyday", sort: "featured", page: 1 })).toBe("/products?category=everyday");
    expect(shopPath({ brand: "mahi", q: "  ragi ", sort: "name-asc", page: 2 })).toBe("/products?brand=mahi&q=ragi&sort=name-asc&page=2");
  });
});
