"use client";

import { CatalogImage } from "@/components/ui/CatalogImage";
import Link from "next/link";
import { cartTotal, deliveryFee, lineAmount, subtotal } from "@/lib/cart";
import { getProduct, getVariant, productName, variantPackLabel } from "@/lib/catalog";
import { checkDelivery, deliveryStatusText, resolveDeliveryConfig } from "@/lib/delivery";
import { t } from "@/lib/i18n";
import { displayPrice, formatInr } from "@/lib/shop";
import type { Locale } from "@/lib/types";
import { useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Button, ButtonLink } from "@/components/ui/Button";

function money(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  return formatInr(amount, locale);
}

export function CartTotals() {
  const { locale } = useLanguage();
  const { lines } = useCart();
  const { confirmed } = useDeliveryLocation();
  const result = checkDelivery(confirmed);
  const productSubtotal = subtotal(lines);
  const fee = deliveryFee(result, resolveDeliveryConfig());
  const total = cartTotal(productSubtotal, fee);
  const deliveryLabel =
    result.status === "available" && fee === 0
      ? t(locale, "cart.freeDelivery")
      : result.status === "available" && fee != null
        ? formatInr(fee, locale)
        : deliveryStatusText(result, locale);

  return (
    <div className="stack" data-testid="cart-totals">
      <p data-testid="cart-subtotal">
        {t(locale, "cart.subtotal")}: {money(productSubtotal, locale)}
      </p>
      <p data-testid="cart-delivery">
        {t(locale, "cart.deliveryFee")}: {deliveryLabel}
      </p>
      {result.status === "available" ? <p data-testid="delivery-distance">{deliveryStatusText(result, locale)}</p> : null}
      <p data-testid="cart-total">
        {t(locale, "cart.total")}: {money(total, locale)}
      </p>
    </div>
  );
}

export function CartPanel({
  showCheckoutLink,
  showCartLink = false,
}: {
  showCheckoutLink: boolean;
  showCartLink?: boolean;
}) {
  const { locale } = useLanguage();
  const { lines, updateQuantity, remove, clear, setDrawerOpen } = useCart();
  const { confirmed } = useDeliveryLocation();
  const outsideRadius = checkDelivery(confirmed).status === "unavailable";
  const closeDrawer = () => setDrawerOpen(false);
  const visibleLines = lines.flatMap((line) => {
    const product = getProduct(line.productId);
    const variant = product ? getVariant(product, line.variantId) : undefined;
    if (!product || !variant) return [];
    return [{ line, product, variant }];
  });

  if (visibleLines.length === 0) {
    return (
      <div className="stack">
        <p data-testid="cart-empty">{t(locale, "cart.empty")}</p>
        <ButtonLink href="/products" data-testid="continue-shopping" onClick={closeDrawer}>
          {t(locale, "cart.continueShopping")}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="stack">
      <ul className="stack cart-lines">
        {visibleLines.map(({ line, product, variant }) => {
          const pack = variantPackLabel(variant, locale);
          const name = productName(product, locale);
          const price = displayPrice(variant);
          const atStockCap = variant.stock != null && line.quantity >= variant.stock;
          return (
            <li
              key={`${line.productId}:${line.variantId}`}
              className="cart-line"
              data-testid={`cart-line-${line.productId}-${line.variantId}`}
            >
              <Link href={`/products/${product.id}`} className="cart-thumb-link" onClick={closeDrawer}>
                <CatalogImage
                  src={product.images[0] ?? ""}
                  alt={name}
                  width={90}
                  height={110}
                  sizes="88px"
                  className="cart-thumb"
                />
              </Link>
              <div className="stack cart-line-body">
                <Link href={`/products/${product.id}`} className="cart-line-name" onClick={closeDrawer}>
                  {name}
                </Link>
                <p>
                  {t(locale, "products.packSize")}: {pack ?? t(locale, "products.packSizeUnknown")}
                </p>
                <p>
                  {t(locale, "products.price")}:{" "}
                  {price.current == null ? (
                    t(locale, "products.priceAtCheckout")
                  ) : (
                    <>
                      <span className="price-current">{formatInr(price.current, locale)}</span>
                      {price.original != null ? (
                        <s className="price-original">{formatInr(price.original, locale)}</s>
                      ) : null}
                    </>
                  )}
                </p>
                <p>
                  {t(locale, "cart.lineTotal")}: {money(lineAmount(line), locale)}
                </p>
                <div className="row cart-qty">
                  <Button
                    variant="secondary"
                    aria-label={t(locale, "cart.decrease")}
                    data-variant={line.variantId}
                    onClick={() => updateQuantity(line.productId, line.variantId, line.quantity - 1)}
                  >
                    −
                  </Button>
                  <span className="cart-qty-value" data-testid={`qty-${line.productId}`} data-variant={line.variantId}>{line.quantity}</span>
                  <Button
                    variant="secondary"
                    aria-label={t(locale, "cart.increase")}
                    data-testid={`increase-${line.productId}`}
                    data-variant={line.variantId}
                    disabled={atStockCap}
                    onClick={() => updateQuantity(line.productId, line.variantId, line.quantity + 1)}
                  >
                    +
                  </Button>
                  <Button
                    variant="ghost"
                    data-testid={`remove-${line.productId}-${line.variantId}`}
                    onClick={() => remove(line.productId, line.variantId)}
                  >
                    {t(locale, "cart.remove")}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <CartTotals />
      <div className="row cart-actions">
        <Button variant="ghost" onClick={clear} data-testid="clear-cart">
          {t(locale, "cart.clear")}
        </Button>
        <ButtonLink href="/products" data-testid="continue-shopping" onClick={closeDrawer}>
          {t(locale, "cart.continueShopping")}
        </ButtonLink>
        {showCartLink ? (
          <ButtonLink href="/cart" data-testid="view-cart" onClick={closeDrawer}>
            {t(locale, "cart.viewCart")}
          </ButtonLink>
        ) : null}
        {showCheckoutLink && !outsideRadius ? (
          <ButtonLink href="/checkout" variant="primary" data-testid="cart-checkout" onClick={closeDrawer}>
            {t(locale, "cart.checkout")}
          </ButtonLink>
        ) : null}
        {showCheckoutLink && outsideRadius ? (
          <Button variant="primary" disabled data-testid="cart-checkout">
            {t(locale, "cart.checkout")}
          </Button>
        ) : null}
        {!showCheckoutLink && !showCartLink ? (
          <ButtonLink href="/cart" data-testid="view-cart" onClick={closeDrawer}>
            {t(locale, "cart.viewCart")}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
