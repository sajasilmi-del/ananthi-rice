"use client";

import { t } from "@/lib/i18n";
import { formatDistanceKm } from "@/lib/delivery";
import type { OrderRequest } from "@/lib/orders";
import { formatInr } from "@/lib/shop";
import type { Locale } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { SectionHeading } from "@/components/ui/SectionHeading";

function money(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  return formatInr(amount, locale);
}

function feeText(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  if (amount === 0) return t(locale, "cart.freeDelivery");
  return formatInr(amount, locale);
}

export function CheckoutConfirmation({ order, locale }: { order: OrderRequest; locale: Locale }) {
  const href = buildWhatsAppUrl(locale, {
    customerName: order.customer.name,
    deliveryLocation: order.customer.address,
    lines: order.lines.map((line) => ({
      name: locale === "ta" ? line.nameTamil : line.nameEnglish,
      packSize: (locale === "ta" ? line.packTamil : line.packEnglish) ?? "",
      quantity: line.quantity,
    })),
  });

  return (
    <section className="stack" data-testid="checkout-confirmation">
      <SectionHeading as="h2" title={t(locale, "checkout.confirmationTitle")} />
      <p data-testid="order-id">
        {t(locale, "checkout.orderId")}: {order.id}
      </p>
      <p data-testid="confirmation-customer">
        {t(locale, "checkout.customerDetails")}: {order.customer.name}, {order.customer.mobile}, {order.customer.email}
      </p>
      <p data-testid="confirmation-address">
        {t(locale, "checkout.deliveryAddress")}: {order.customer.address}
      </p>
      <p data-testid="confirmation-distance">
        {t(locale, "checkout.distance")}: {formatDistanceKm(order.distanceKm)} {t(locale, "checkout.kilometre")}
      </p>
      <div className="stack" data-testid="confirmation-products">
        <h3>{t(locale, "checkout.products")}</h3>
        {order.lines.map((line) => (
          <p className="order-line" key={`${line.productId}-${line.variantId}`}>
            <span>{locale === "ta" ? line.nameTamil : line.nameEnglish}</span>
            <span>{(locale === "ta" ? line.packTamil : line.packEnglish) ?? t(locale, "products.packSizeUnknown")}</span>
            <span>
              {t(locale, "whatsapp.quantity")}: {line.quantity}
            </span>
            <span>{money(line.lineTotal, locale)}</span>
          </p>
        ))}
      </div>
      <p data-testid="confirmation-subtotal">
        {t(locale, "cart.subtotal")}: {money(order.subtotal, locale)}
      </p>
      <p data-testid="confirmation-fee">
        {t(locale, "cart.deliveryFee")}: {feeText(order.deliveryFee, locale)}
      </p>
      <p data-testid="confirmation-total">
        {t(locale, "cart.total")}: {money(order.total, locale)}
      </p>
      <p data-testid="confirmation-payment">
        {t(locale, "checkout.paymentStatus")}: {t(locale, "checkout.paymentNotTaken")} {t(locale, `payment.${order.payment.method}`)}
      </p>
      <p data-testid="confirmation-status">
        {t(locale, "checkout.orderStatus")}: {t(locale, "checkout.statusRequest")}. {t(locale, "checkout.notPaid")}
      </p>
      <WhatsAppButton href={href} testId="checkout-whatsapp">
        {t(locale, "checkout.whatsappOrder")}
      </WhatsAppButton>
    </section>
  );
}
