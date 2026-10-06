"use client";

import { useEffect, useRef, useState } from "react";
import { cartTotal, deliveryFee, lineAmount, subtotal } from "@/lib/cart";
import type { CheckoutReview } from "@/lib/checkout-review";
import { getProduct, getVariant, productName, variantPackLabel } from "@/lib/catalog";
import { checkDelivery, checkoutAllowed, DELIVERY_RADIUS_KM, deliveryStatusText, resolveDeliveryConfig } from "@/lib/delivery";
import type { DeliveryResult } from "@/lib/delivery";
import { formatMessage, t } from "@/lib/i18n";
import type { OrderRequest } from "@/lib/orders";
import { saveOrderRequest } from "@/lib/orders";
import { openRazorpayCheckout } from "@/lib/payment/checkout-widget";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import type { PaymentMethod } from "@/lib/payment/types";
import { formatInr } from "@/lib/shop";
import type { CartLine, Locale } from "@/lib/types";
import { validateCustomer } from "@/lib/validation";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { CartPanel } from "@/components/CartPanel";
import { CheckoutConfirmation } from "@/components/CheckoutConfirmation";
import { DeliveryPicker } from "@/components/DeliveryPicker";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

const steps = [
  "checkout.flowCart",
  "checkout.flowCustomer",
  "checkout.flowLocation",
  "checkout.flowRadius",
  "checkout.flowAddress",
  "checkout.flowSummary",
  "checkout.flowPayment",
  "checkout.flowConfirm",
] as const;

function money(amount: number | null, locale: Locale): string {
  if (amount == null) return t(locale, "products.priceAtCheckout");
  return formatInr(amount, locale);
}

function SummaryLines({ lines }: { lines: CartLine[] }) {
  const { locale } = useLanguage();
  return (
    <div className="stack" data-testid="order-summary">
      {lines.map((line) => {
        const product = getProduct(line.productId);
        const variant = product ? getVariant(product, line.variantId) : undefined;
        if (!product || !variant) return null;
        return (
          <p className="order-line" key={`${line.productId}-${line.variantId}`}>
            <span>{productName(product, locale)}</span>
            <span>{variantPackLabel(variant, locale) ?? t(locale, "products.packSizeUnknown")}</span>
            <span>
              {t(locale, "whatsapp.quantity")}: {line.quantity}
            </span>
            <span>{money(lineAmount(line), locale)}</span>
          </p>
        );
      })}
    </div>
  );
}

function readReview(value: unknown): CheckoutReview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { ok?: boolean; order?: OrderRequest; issues?: unknown; delivery?: DeliveryResult };
  if (record.ok === true && record.order) return { ok: true, order: record.order };
  if (record.ok === false && Array.isArray(record.issues) && record.delivery && typeof record.delivery === "object") {
    return { ok: false, issues: record.issues.filter((issue) => typeof issue === "string"), delivery: record.delivery };
  }
  if (record.ok === false && Array.isArray(record.issues)) {
    return { ok: false, issues: record.issues.filter((issue) => typeof issue === "string"), delivery: { status: "invalid_location" } };
  }
  return null;
}

const onlineMethods = new Set<PaymentMethod>(["upi", "card", "netbanking"]);

function isAccepted(value: CheckoutReview | null): value is { ok: true; order: OrderRequest } {
  if (!value?.ok) return false;
  if (
    value.order.status === "request_only" &&
    value.order.payment.status === "not_confirmed" &&
    value.order.payment.reason === "provider_not_configured"
  ) {
    return true;
  }
  return (
    value.order.status === "paid" &&
    value.order.payment.status === "captured" &&
    (value.order.payment.reason === "razorpay_test" || value.order.payment.reason === "razorpay_live")
  );
}

export default function CheckoutPage() {
  const { locale } = useLanguage();
  const { lines, clear } = useCart();
  const { confirmed } = useDeliveryLocation();
  const { user } = useAuth();
  const edited = useRef(false);
  const [name, setName] = useState(user?.name ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noticeKey, setNoticeKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [razorpayMode, setRazorpayMode] = useState<"test" | "live" | null>(null);
  const result = checkDelivery(confirmed);
  const allowed = checkoutAllowed(result) && lines.length > 0;
  const provider = createUnconfiguredPaymentProvider();
  const productSubtotal = subtotal(lines);
  const fee = deliveryFee(result, resolveDeliveryConfig());
  const total = cartTotal(productSubtotal, fee);
  const feeLabel =
    result.status === "available" && fee === 0
      ? t(locale, "cart.freeDelivery")
      : result.status === "available" && fee != null
        ? formatInr(fee, locale)
        : deliveryStatusText(result, locale);
  const fallbackHref = cartWhatsAppUrl(locale, name, lines, address || confirmed?.addressLabel || "");

  useEffect(() => {
    if (!user || edited.current) return;
    setName(user.name);
    setMobile(user.mobile);
    setEmail(user.email);
    setAddress(user.address);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/razorpay")
      .then((response) => response.json())
      .then((payload: { enabled?: boolean; mode?: string }) => {
        if (cancelled) return;
        if (payload.enabled && (payload.mode === "test" || payload.mode === "live")) setRazorpayMode(payload.mode);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function edit<T>(update: (value: T) => void) {
    return (value: T) => {
      edited.current = true;
      update(value);
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const fresh = checkDelivery(confirmed);
    const nextErrors = validateCustomer({ name, mobile, email, address }, locale, { password: false });
    if (!confirmed) nextErrors.location = t(locale, "validation.locationRequired");
    if (!method) nextErrors.method = t(locale, "validation.methodRequired");
    if (lines.length === 0) nextErrors.cart = t(locale, "checkout.empty");
    if (!checkoutAllowed(fresh)) nextErrors.delivery = deliveryStatusText(fresh, locale);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !method || !confirmed || !checkoutAllowed(fresh)) return;

    setSubmitting(true);
    try {
      const draft = {
        customer: { name, mobile, email, address },
        location: confirmed,
        lines,
        method,
      };
      let razorpay: { orderId: string; paymentId: string; signature: string } | undefined;
      if (razorpayMode && onlineMethods.has(method)) {
        const createdResponse = await fetch("/api/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const created = (await createdResponse.json()) as {
          ok?: boolean;
          keyId?: string;
          orderId?: string;
          amount?: number;
          currency?: string;
        };
        if (!createdResponse.ok || !created.ok || !created.keyId || !created.orderId || created.currency !== "INR" || typeof created.amount !== "number") {
          setErrors({ payment: t(locale, "payment.failed") });
          setNoticeKey("");
          return;
        }
        const widget = await openRazorpayCheckout({
          keyId: created.keyId,
          orderId: created.orderId,
          amount: created.amount,
          name,
          email,
          contact: mobile,
        });
        if (widget === "cancelled") {
          setErrors({ payment: t(locale, "payment.cancelled") });
          setNoticeKey("");
          return;
        }
        if (widget === "failed") {
          setErrors({ payment: t(locale, "payment.failed") });
          setNoticeKey("");
          return;
        }
        razorpay = {
          orderId: widget.razorpay_order_id,
          paymentId: widget.razorpay_payment_id,
          signature: widget.razorpay_signature,
        };
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, razorpay }),
      });
      const review = readReview(await response.json());
      if (!review || !isAccepted(review)) {
        const rejected = validateCustomer({ name, mobile, email, address }, locale, { password: false });
        const issues = review && !review.ok ? review.issues : ["invalid"];
        if (issues.includes("location")) rejected.location = t(locale, "validation.locationRequired");
        if (issues.includes("method")) rejected.method = t(locale, "validation.methodRequired");
        if (issues.includes("empty")) rejected.cart = t(locale, "checkout.empty");
        if (issues.includes("delivery") && review && !review.ok) {
          rejected.delivery = deliveryStatusText(review.delivery, locale);
        }
        if (issues.includes("payment") || issues.includes("invalid")) rejected.payment = t(locale, "payment.notConfigured");
        setErrors(rejected);
        setNoticeKey("checkout.paymentNotTaken");
        return;
      }
      saveOrderRequest(window.localStorage, review.order);
      setOrder(review.order);
      clear();
      const captured = review.order.payment.status === "captured" ? review.order.payment : null;
      setNoticeKey(captured ? (captured.reason === "razorpay_live" ? "checkout.liveRecorded" : "checkout.testRecorded") : "checkout.requestSaved");
    } catch {
      setErrors({ delivery: t(locale, "errors.network") });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack checkout-page" data-testid="checkout-page">
      <SectionHeading as="h1" title={t(locale, "checkout.title")} />
      <ol className="checkout-steps" data-testid="checkout-flow">
        {steps.map((key) => (
          <li key={key} aria-current={order && key === "checkout.flowConfirm" ? "step" : undefined}>
            {t(locale, key)}
          </li>
        ))}
      </ol>
      {order ? (
        <CheckoutConfirmation order={order} locale={locale} />
      ) : (
        <form className="stack" noValidate onSubmit={onSubmit}>
          {lines.length === 0 && !noticeKey ? <p>{t(locale, "checkout.empty")}</p> : null}
          <section className="stack" data-checkout-step="cart">
            <SectionHeading title={t(locale, "cart.title")} />
            <CartPanel showCheckoutLink={false} />
          </section>
          <section className="stack" data-checkout-step="customer">
            <SectionHeading title={t(locale, "checkout.customerDetails")} />
            <FormField label={t(locale, "forms.name")} error={errors.name}>
              <input value={name} autoComplete="name" onChange={(event) => edit(setName)(event.target.value)} />
            </FormField>
            <FormField label={t(locale, "forms.mobile")} error={errors.mobile}>
              <input type="tel" value={mobile} autoComplete="tel" inputMode="numeric" onChange={(event) => edit(setMobile)(event.target.value)} />
            </FormField>
            <FormField label={t(locale, "forms.email")} error={errors.email}>
              <input type="email" value={email} autoComplete="email" onChange={(event) => edit(setEmail)(event.target.value)} />
            </FormField>
          </section>
          <section className="stack" data-checkout-step="location">
            <SectionHeading title={t(locale, "checkout.locationVerification")} />
            <DeliveryPicker heading="h3" />
            {errors.location ? <p className="error">{errors.location}</p> : null}
          </section>
          <section className="stack" data-checkout-step="radius">
            <SectionHeading title={formatMessage(t(locale, "checkout.radiusCheck"), { km: String(DELIVERY_RADIUS_KM) })} />
            <p data-testid="checkout-delivery">{deliveryStatusText(result, locale)}</p>
            <p>{t(locale, "checkout.recheck")}</p>
            {errors.delivery ? <p className="error">{errors.delivery}</p> : null}
          </section>
          <section className="stack" data-checkout-step="address">
            <SectionHeading title={t(locale, "checkout.deliveryAddress")} />
            <FormField label={t(locale, "forms.address")} error={errors.address}>
              <textarea value={address} autoComplete="street-address" onChange={(event) => edit(setAddress)(event.target.value)} />
            </FormField>
          </section>
          <section className="stack" data-checkout-step="summary">
            <SectionHeading title={t(locale, "checkout.orderSummary")} />
            <SummaryLines lines={lines} />
            {lines.length > 0 ? (
              <>
                <p data-testid="summary-subtotal">
                  {t(locale, "cart.subtotal")}: {money(productSubtotal, locale)}
                </p>
                <p data-testid="summary-fee">
                  {t(locale, "cart.deliveryFee")}: {feeLabel}
                </p>
                <p data-testid="summary-total">
                  {t(locale, "cart.total")}: {money(total, locale)}
                </p>
              </>
            ) : null}
            {errors.cart ? <p className="error">{errors.cart}</p> : null}
          </section>
          <section className="stack" data-checkout-step="payment">
            <SectionHeading title={t(locale, "checkout.payment")} />
            <p data-testid="payment-note">
              {razorpayMode === "test"
                ? t(locale, "payment.testMode")
                : razorpayMode === "live"
                  ? t(locale, "payment.liveMode")
                  : t(locale, "payment.notConfigured")}
            </p>
            {provider.listMethods().map((item) => (
              <label key={item} className="choice">
                <input
                  type="radio"
                  name="payment"
                  value={item}
                  data-testid={`payment-${item}`}
                  checked={method === item}
                  onChange={() => setMethod(item)}
                />
                {t(locale, `payment.${item}`)}
              </label>
            ))}
            {errors.method ? <p className="error">{errors.method}</p> : null}
            {errors.payment ? <p className="error">{errors.payment}</p> : null}
          </section>
          <Button type="submit" data-testid="checkout-submit" disabled={!allowed || submitting}>
            {razorpayMode && method && onlineMethods.has(method) ? t(locale, "checkout.continueRazorpay") : t(locale, "checkout.placeRequest")}
          </Button>
          {!allowed ? <p>{t(locale, "checkout.blocked")}</p> : null}
          <WhatsAppButton href={fallbackHref} testId="checkout-whatsapp">
            {t(locale, "checkout.whatsappOrder")}
          </WhatsAppButton>
        </form>
      )}
      {noticeKey ? (
        <p className="notice" data-testid="checkout-notice">
          {t(locale, noticeKey)}
          {order?.payment.status === "captured" ? "" : ` ${t(locale, "checkout.notPaid")}`}
        </p>
      ) : null}
    </div>
  );
}
