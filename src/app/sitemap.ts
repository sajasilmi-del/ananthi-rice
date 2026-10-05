import type { MetadataRoute } from "next";
import { legalPages, visibleProducts } from "@/lib/catalog";
import { productPath } from "@/lib/product-page";
import { absoluteUrl, localePath } from "@/lib/seo";

function entry(path: string, priority: number): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(localePath(path, "en")),
    changeFrequency: "weekly",
    priority,
    alternates: {
      languages: {
        en: absoluteUrl(localePath(path, "en")),
        ta: absoluteUrl(localePath(path, "ta")),
      },
    },
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/products", "/brands", "/faq", "/contact", ...legalPages.map((page) => `/legal/${page.id}`)];
  const products = visibleProducts().map((product) => productPath(product.id));
  return [...pages.map((path) => entry(path, path === "/" ? 1 : 0.7)), ...products.map((path) => entry(path, 0.6))];
}
