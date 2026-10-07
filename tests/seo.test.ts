import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getProduct, site } from "@/lib/catalog";
import { breadcrumbJsonLd, localePath, pageMetadata, productJsonLd, siteJsonLd, siteOrigin } from "@/lib/seo";
import type { Product } from "@/lib/types";

describe("production SEO", () => {
  it("uses the published site origin and crawlable Tamil URLs", () => {
    expect(siteOrigin()).toBe("https://www.ananthirice.shop");
    expect(localePath("/products", "en")).toBe("/products");
    expect(localePath("/products", "ta")).toBe("/products?lang=ta");
    expect(localePath("/products?category=everyday", "ta")).toBe("/products?category=everyday&lang=ta");
    expect(localePath("/products?lang=ta", "en")).toBe("/products");
  });

  it("publishes titles, descriptions, canonicals, and social cards without a fake price", () => {
    const meta = pageMetadata({
      locale: "en",
      title: "Products",
      description: "Quality Rice with 30 Years of Tradition",
      path: "/products",
    });
    expect(meta.title).toBe("Products");
    expect(meta.description).not.toMatch(/₹|rs\.?\s*\d/i);
    expect(meta.alternates).toMatchObject({
      canonical: "/products",
      languages: { en: "/products", ta: "/products?lang=ta", "x-default": "/products" },
    });
    expect(meta.openGraph).toMatchObject({ title: "Products", siteName: site.brandName, locale: "en_IN" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Products" });
    const home = pageMetadata({ locale: "ta", title: "ANANTHI RICE", description: "அரிசி", path: "/" });
    expect(home.alternates).toBeUndefined();
    expect(home.openGraph).not.toHaveProperty("url");
    const tamil = pageMetadata({ locale: "ta", title: "பொருட்கள்", description: "அரிசி", path: "/products", absoluteTitle: true });
    expect(tamil.title).toEqual({ absolute: "பொருட்கள்" });
    expect(tamil.alternates).toMatchObject({ canonical: "/products?lang=ta" });
    const hidden = pageMetadata({ locale: "en", title: "Cart", description: "Cart", path: "/cart", index: false });
    expect(hidden.robots).toEqual({ index: false, follow: false });
  });

  it("describes the organization and products without coordinates or an invented price", () => {
    const graph = JSON.stringify(siteJsonLd("en"));
    expect(graph).toContain(site.brandName);
    expect(graph).toContain(site.legalName);
    expect(graph).toContain(site.email);
    expect(graph).toContain(site.phones[0]);
    expect(graph).toContain(site.fssai.registrationNumber);
    expect(graph).toContain(site.gst.gstin);
    expect(graph).not.toContain("latitude");
    expect(graph).not.toContain("geo");
    expect(graph).not.toContain("\"price\"");

    const product = getProduct("ponni-boiled-rice");
    expect(product).toBeDefined();
    const plain = productJsonLd(product as Product, "en");
    expect(plain.name).toBe(product?.nameEnglish);
    const offers = plain.offers as { price: number; priceCurrency: string }[];
    expect(offers.map((offer) => offer.price)).toEqual([160, 799, 1419, 2939]);
    expect(offers.every((offer) => offer.priceCurrency === "INR" && !("availability" in offer))).toBe(true);

    const priced = {
      ...(product as Product),
      variants: [{ ...(product as Product).variants[0], price: 120, salePrice: null, stock: null }],
    };
    const offer = productJsonLd(priced, "en").offers as { price: number; priceCurrency: string };
    expect(offer).toMatchObject({ price: 120, priceCurrency: "INR" });
    expect(offer).not.toHaveProperty("availability");

    const crumbs = breadcrumbJsonLd(
      [
        { name: "Home", path: "/" },
        { name: "Products", path: "/products" },
      ],
      "ta",
    );
    expect(JSON.stringify(crumbs)).toContain("https://www.ananthirice.shop/?lang=ta");
    expect(JSON.stringify(crumbs)).toContain("https://www.ananthirice.shop/products?lang=ta");
  });

  it("allows public pages and keeps private flows out of the crawl", () => {
    expect(readFileSync("public/google12b0e83768a8c6a3.html", "utf8").trim()).toBe(
      "google-site-verification: google12b0e83768a8c6a3.html",
    );
    expect(robots().sitemap).toBe("https://www.ananthirice.shop/sitemap.xml");
    expect(robots().rules).toMatchObject({ disallow: ["/api/", "/account", "/cart", "/checkout"] });
    const urls = sitemap().map((item) => item.url);
    expect(urls).toContain("https://www.ananthirice.shop/");
    expect(urls).toContain("https://www.ananthirice.shop/products/ponni-boiled-rice");
    expect(urls).toContain("https://www.ananthirice.shop/legal/delivery");
    expect(urls.some((url) => url.includes("/cart") || url.includes("/checkout") || url.includes("/account"))).toBe(false);
    const home = sitemap().find((item) => item.url.endsWith("www.ananthirice.shop/"));
    expect(home?.alternates?.languages?.ta).toBe("https://www.ananthirice.shop/?lang=ta");
  });
});
