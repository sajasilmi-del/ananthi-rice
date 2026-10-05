import brandsData from "@/data/brands.json";
import categoriesData from "@/data/categories.json";
import deliveryData from "@/data/delivery.json";
import faqData from "@/data/faq.json";
import legalData from "@/data/legal.json";
import locationsData from "@/data/locations.json";
import productsData from "@/data/products.json";
import siteData from "@/data/site.json";
import type {
  Brand,
  Category,
  DeliveryConfig,
  FaqItem,
  LegalPage,
  Locale,
  LocationRecord,
  Product,
  SiteConfig,
  Variant,
} from "@/lib/types";

export const products = productsData as Product[];
export const brands = brandsData as Brand[];
export const categories = categoriesData.categories as Category[];
export const ricePackSizeNote = {
  ta: categoriesData.ricePackSizes.noteTamil,
  en: categoriesData.ricePackSizes.noteEnglish,
};
export const locations = locationsData as LocationRecord[];
export const faq = faqData as FaqItem[];
export const legalPages = legalData as LegalPage[];
export const deliveryConfig = deliveryData as DeliveryConfig;
export const site = siteData as SiteConfig;

export function getProduct(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}

export function visibleProducts(): Product[] {
  return products.filter((product) => product.active);
}

export function featuredProducts(): Product[] {
  return visibleProducts().filter((product) => product.featured);
}

export function productsInCategory(categoryId: string): Product[] {
  return visibleProducts().filter((product) => product.category === categoryId);
}

export function relatedProducts(product: Product, limit = 4): Product[] {
  return visibleProducts()
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, limit);
}

export function getBrand(id: string): Brand | undefined {
  return brands.find((brand) => brand.id === id);
}

export function getCategory(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getVariant(product: Product, variantId: string): Variant | undefined {
  return product.variants.find((variant) => variant.id === variantId);
}

export function productName(product: Product, locale: Locale): string {
  return locale === "ta" ? product.nameTamil : product.nameEnglish;
}

export function brandName(brand: Brand, locale: Locale): string {
  return locale === "ta" ? brand.nameTamil : brand.nameEnglish;
}

export function productDescription(product: Product, locale: Locale): string {
  return locale === "ta" ? product.descriptionTamil : product.descriptionEnglish;
}

export function variantPackLabel(variant: Variant, locale: Locale): string | null {
  return locale === "ta" ? variant.packSizeTamil : variant.packSize;
}

export function isPurchasable(variant: Variant): boolean {
  if (variant.stock == null) return true;
  return variant.stock > 0;
}

export function unitPrice(variant: Variant): number | null {
  if (variant.salePrice != null) return variant.salePrice;
  return variant.price;
}
