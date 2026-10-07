"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clampQuantity } from "@/lib/cart";
import {
  getBrand,
  getCategory,
  isPurchasable,
  productDescription,
  productName,
  ricePackSizeNote,
  site,
  variantPackLabel,
} from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { productPath } from "@/lib/product-page";
import { displayPrice, formatInr } from "@/lib/shop";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/ui/ProductCard";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

export function ProductPurchase({ product, detail = false }: { product: Product; detail?: boolean }) {
  const { locale } = useLanguage();
  const { add } = useCart();
  const { user } = useAuth();
  const { confirmed } = useDeliveryLocation();
  const router = useRouter();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  useEffect(() => {
    if (!variant) return;
    const next = clampQuantity(quantity, variant.stock);
    if (next == null) {
      setQuantity(1);
      return;
    }
    if (next !== quantity) setQuantity(next);
  }, [quantity, variant]);
  const brand = getBrand(product.brand);
  const category = getCategory(product.category);
  const name = productName(product, locale);
  const pack = variant ? variantPackLabel(variant, locale) : null;
  const purchasable = variant ? isPurchasable(variant) : false;
  const whatsappHref = buildWhatsAppUrl(locale, {
    customerName: user?.name ?? "",
    lines: [
      {
        name,
        packSize: pack ?? t(locale, "products.packSizeUnknown"),
        quantity,
      },
    ],
    deliveryLocation: confirmed?.addressLabel ?? "",
  });

  if (!variant) return null;

  function onQuantity(event: React.ChangeEvent<HTMLInputElement>) {
    const next = clampQuantity(Number(event.target.value), variant.stock);
    if (next == null) {
      event.target.value = String(quantity);
      return;
    }
    event.target.value = String(next);
    setQuantity(next);
  }

  function addCurrent() {
    if (!isPurchasable(variant)) return;
    const next = clampQuantity(quantity, variant.stock);
    if (next == null) return;
    add({ productId: product.id, variantId: variant.id, quantity: next });
  }

  const price = displayPrice(variant);

  const brandLabel = locale === "ta" ? brand?.nameTamil : brand?.nameEnglish;
  const categoryLabel = locale === "ta" ? category?.nameTamil : category?.nameEnglish;
  const packOptions = product.variants.map((item) => (
    <option key={item.id} value={item.id}>
      {variantPackLabel(item, locale) ?? t(locale, "products.packSizeUnknown")}
    </option>
  ));
  const priceText =
    price.current == null ? (
      t(locale, "products.priceAtCheckout")
    ) : (
      <>
        <span className="price-current">{formatInr(price.current, locale)}</span>
        {price.original != null ? <s className="price-original">{formatInr(price.original, locale)}</s> : null}
      </>
    );

  if (!detail) {
    return (
      <ProductCard
        testId={`product-${product.id}`}
        brand={product.brand}
        href={productPath(product.id)}
        imageSrc={product.images[0] ?? ""}
        images={product.images}
        imageAlt={name}
      >
        <Badge tone={product.brand}>{brandLabel}</Badge>
        <h3>
          <Link href={productPath(product.id)}>{name}</Link>
        </h3>
        <p className="product-description">{productDescription(product, locale)}</p>
        <div className="product-card-foot">
          <select value={variant.id} aria-label={t(locale, "products.packSize")} onChange={(event) => setVariantId(event.target.value)}>
            {packOptions}
          </select>
          <p className="price-line">{priceText}</p>
          <div className="product-actions">
            <Button data-brand={product.brand} data-testid={`add-${product.id}`} disabled={!purchasable} onClick={addCurrent}>
              {t(locale, "products.addToCart")}
            </Button>
            <WhatsAppButton href={whatsappHref}>{t(locale, "products.whatsappOrder")}</WhatsAppButton>
          </div>
        </div>
      </ProductCard>
    );
  }

  return (
    <ProductCard
      testId={`product-${product.id}`}
      detail
      brand={product.brand}
      imageSrc={product.images[0] ?? ""}
      images={product.images}
      imageAlt={name}
    >
      <Badge tone={product.brand} testId="product-brand">
        {brandLabel}
      </Badge>
      <div className="product-title">
        <h1 data-testid={locale === "ta" ? "product-name-ta" : "product-name-en"}>{name}</h1>
        <p className="product-name-alt" data-testid={locale === "ta" ? "product-name-en" : "product-name-ta"}>
          {locale === "ta" ? product.nameEnglish : product.nameTamil}
        </p>
      </div>
      <p className="product-price-big" data-testid="product-price">
        <span className="sr-only">{t(locale, "products.price")}: </span>
        {priceText}
      </p>
      <p className="product-description" data-testid="product-description">
        {productDescription(product, locale)}
      </p>
      <div className="purchase-box">
        <div className="purchase-fields">
          <label className="field">
            {t(locale, "products.packSize")}
            <select
              value={variant.id}
              aria-label={t(locale, "products.packSize")}
              data-testid="product-pack"
              onChange={(event) => setVariantId(event.target.value)}
            >
              {packOptions}
            </select>
          </label>
          <label className="field">
            {t(locale, "products.quantity")}
            <input
              type="number"
              min={1}
              step={1}
              max={variant.stock != null && variant.stock > 0 ? variant.stock : undefined}
              value={quantity}
              aria-label={t(locale, "products.quantity")}
              data-testid="product-quantity"
              onChange={onQuantity}
            />
          </label>
        </div>
        <p className="note">{locale === "ta" ? ricePackSizeNote.ta : ricePackSizeNote.en}</p>
        <div className="product-actions">
          <Button data-brand={product.brand} data-testid={`add-${product.id}`} className="btn-lg" disabled={!purchasable} onClick={addCurrent}>
            {t(locale, "products.addToCart")}
          </Button>
          <Button
            variant="secondary"
            className="btn-lg"
            disabled={!purchasable}
            onClick={() => {
              addCurrent();
              router.push("/checkout");
            }}
          >
            {t(locale, "products.buyNow")}
          </Button>
        </div>
        <WhatsAppButton href={whatsappHref} testId="whatsapp-product">
          {t(locale, "products.whatsappOrder")}
        </WhatsAppButton>
      </div>
      <dl className="product-facts">
        <div>
          <dt>{t(locale, "products.brand")}</dt>
          <dd>{brandLabel}</dd>
        </div>
        <div>
          <dt>{t(locale, "products.category")}</dt>
          <dd>{categoryLabel}</dd>
        </div>
        {variant.stock != null ? (
          <div data-testid="product-availability">
            <dt>{t(locale, "products.availability")}</dt>
            <dd>{variant.stock > 0 ? String(variant.stock) : t(locale, "products.unavailable")}</dd>
          </div>
        ) : null}
        <div data-testid="product-gstin">
          <dt>{t(locale, "footer.gstin")}</dt>
          <dd>{site.gst.gstin}</dd>
        </div>
        <div data-testid="product-fssai">
          <dt>{t(locale, "products.fssai")}</dt>
          <dd>
            <a href={site.fssai.lookupUrl} target="_blank" rel="noreferrer">{site.fssai.registrationNumber}</a>
          </dd>
        </div>
      </dl>
    </ProductCard>
  );
}
