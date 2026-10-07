"use client";

import { useEffect } from "react";
import { site } from "@/lib/catalog";
import { formatMessage, t } from "@/lib/i18n";
import { buildTaxInvoice, type GstRate, type TaxInvoice } from "@/lib/invoice";
import type { OrderRequest } from "@/lib/orders";
import { formatInr } from "@/lib/shop";
import { shopOrderWhatsAppUrl } from "@/lib/shop-notice";
import type { Locale } from "@/lib/types";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { SectionHeading } from "@/components/ui/SectionHeading";

const openedShopOrders = new Set<string>();

function money(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  return formatInr(amount, locale);
}

function feeText(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  if (amount === 0) return t(locale, "cart.freeDelivery");
  return formatInr(amount, locale);
}

function paise(amount: number, locale: Locale): string {
  return formatInr(amount / 100, locale);
}

function rateLabel(rate: GstRate, locale: Locale): string {
  if (rate === 0) return t(locale, "checkout.nilRated");
  return formatMessage(t(locale, "checkout.rateSplit"), { rate, half: "2.5" });
}

function paymentLabel(order: OrderRequest, locale: Locale): string {
  const payment = order.payment;
  if (payment.status === "captured") {
    return formatMessage(t(locale, "checkout.paidOnline"), { reference: payment.razorpayPaymentId });
  }
  if (payment.method === "cod") return t(locale, "checkout.codUnpaid");
  return t(locale, "checkout.notPaidOnline");
}

function TaxInvoiceView({ invoice, order, locale }: { invoice: TaxInvoice; order: OrderRequest; locale: Locale }) {
  const state = `${locale === "ta" ? site.gst.stateTamil : site.gst.state} (${site.gst.stateCode})`;
  return (
    <article className="tax-invoice" data-testid="tax-invoice">
      <h3>{t(locale, "checkout.taxInvoice")}</h3>
      <p data-testid="invoice-number">
        {t(locale, "checkout.invoiceNumber")}: {invoice.number}
      </p>
      <p>
        {t(locale, "checkout.invoiceDate")}: {invoice.date}
      </p>
      <p>
        {t(locale, "checkout.seller")}: {site.brandName}
      </p>
      <p>
        {t(locale, "checkout.tradeName")}: {site.gst.tradeName}
      </p>
      <p>
        {t(locale, "checkout.legalName")}: {site.gst.legalName}
      </p>
      <p data-testid="invoice-gstin">
        {t(locale, "checkout.gstin")}: {site.gst.gstin}
      </p>
      <p>
        {t(locale, "checkout.principalPlace")}: {site.gst.principalAddress}
      </p>
      <p>
        {t(locale, "checkout.registration")}: {site.gst.registrationType}
      </p>
      <p>
        {t(locale, "products.fssai")}: {site.fssai.registrationNumber}
      </p>
      <p>
        {t(locale, "checkout.placeOfSupply")}: {state}
      </p>
      <p>
        {t(locale, "checkout.reverseCharge")}: {t(locale, "checkout.reverseChargeNo")}
      </p>
      <p>
        {t(locale, "checkout.billTo")}: {order.customer.name}, {order.customer.email}
      </p>
      <p>
        {t(locale, "checkout.shipTo")}: {order.customer.address}
      </p>
      {invoice.lines.map((line) => (
        <p className="invoice-line" data-testid="invoice-line" key={`${line.productId}-${line.variantId}`}>
          <span>{locale === "ta" ? line.nameTamil : line.nameEnglish}</span>
          <span>{(locale === "ta" ? line.packTamil : line.packEnglish) ?? t(locale, "products.packSizeUnknown")}</span>
          <span>
            {t(locale, "checkout.hsn")}: {line.hsn}
          </span>
          <span>
            {t(locale, "whatsapp.quantity")}: {line.quantity}
          </span>
          <span>{rateLabel(line.ratePercent, locale)}</span>
          <span>
            {t(locale, "checkout.taxableValue")}: {paise(line.taxablePaise, locale)}
          </span>
          <span>
            {t(locale, "checkout.cgst")}: {paise(line.cgstPaise, locale)}
          </span>
          <span>
            {t(locale, "checkout.sgst")}: {paise(line.sgstPaise, locale)}
          </span>
          <span>{paise(line.totalPaise, locale)}</span>
        </p>
      ))}
      <p>
        {t(locale, "checkout.taxableValue")}: {paise(invoice.taxablePaise, locale)}
      </p>
      <p>
        {t(locale, "checkout.cgst")}: {paise(invoice.cgstPaise, locale)}
      </p>
      <p>
        {t(locale, "checkout.sgst")}: {paise(invoice.sgstPaise, locale)}
      </p>
      <p>
        {t(locale, "cart.deliveryFee")}: {feeText(order.deliveryFee, locale)}
      </p>
      <p data-testid="invoice-total">
        {t(locale, "cart.total")}: {paise(invoice.totalPaise, locale)}
      </p>
      <p>{paymentLabel(order, locale)}</p>
      <p>{t(locale, "checkout.inclusiveNote")}</p>
    </article>
  );
}

export function CheckoutConfirmation({
  order,
  locale,
  invoiceMail,
}: {
  order: OrderRequest;
  locale: Locale;
  invoiceMail?: { shop: boolean; customer: boolean } | null;
}) {
  const href = shopOrderWhatsAppUrl(order);
  const payment = order.payment;
  const paid = payment.status === "captured";
  const invoice = buildTaxInvoice(order);
  const mailed = invoiceMail?.shop === true && invoiceMail.customer === true;
  useEffect(() => {
    if (openedShopOrders.has(order.id)) return;
    openedShopOrders.add(order.id);
    const popup = window.open(href, "_blank");
    if (popup) popup.opener = null;
  }, [href, order.id]);

  return (
    <section className="stack" data-testid="checkout-confirmation">
      <SectionHeading as="h2" title={t(locale, paid ? "checkout.paidTitle" : "checkout.confirmationTitle")} />
      <p data-testid="order-id">
        {t(locale, "checkout.orderId")}: {order.id}
      </p>
      <p data-testid="confirmation-customer">
        {t(locale, "checkout.customerDetails")}: {order.customer.name}, {order.customer.mobile}, {order.customer.email}
      </p>
      <p data-testid="confirmation-address">
        {t(locale, "checkout.deliveryAddress")}: {order.customer.address}
      </p>
      <p data-testid="confirmation-area">
        {t(locale, "checkout.serviceArea")}: {locale === "ta" ? order.serviceArea.areasTamil : order.serviceArea.areasEnglish} ({order.serviceArea.pincode})
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
        {t(locale, "checkout.paymentStatus")}:{" "}
        {payment.status === "captured"
          ? t(locale, payment.reason === "razorpay_live" ? "checkout.liveCaptured" : "checkout.paymentCaptured")
          : t(locale, "checkout.paymentNotTaken")}{" "}
        {t(locale, `payment.${payment.method}`)}
      </p>
      {payment.status === "captured" ? (
        <p data-testid="confirmation-reference">
          {t(locale, "checkout.paymentReference")}: {payment.razorpayPaymentId}
        </p>
      ) : null}
      <p data-testid="confirmation-status">
        {t(locale, "checkout.orderStatus")}:{" "}
        {payment.status === "captured"
          ? t(locale, payment.reason === "razorpay_live" ? "checkout.liveRecorded" : "checkout.testRecorded")
          : `${t(locale, "checkout.statusRequest")}. ${t(locale, "checkout.notPaid")}`}
      </p>
      <TaxInvoiceView invoice={invoice} order={order} locale={locale} />
      <p data-testid="invoice-mail">{t(locale, mailed ? "checkout.invoiceSent" : "checkout.invoiceKept")}</p>
      <WhatsAppButton href={href} testId="checkout-whatsapp">
        {t(locale, "checkout.whatsappOrder")}
      </WhatsAppButton>
    </section>
  );
}
