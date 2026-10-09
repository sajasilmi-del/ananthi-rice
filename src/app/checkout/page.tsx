"use client";

import { useEffect, useRef, useState } from "react";
import { cartTotal, deliveryFee, lineAmount, subtotal } from "@/lib/cart";
import type { CheckoutReview } from "@/lib/checkout-review";
import { deliveryConfig, getProduct, getVariant, productName, variantPackLabel } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import type { OrderRequest } from "@/lib/orders";
import { saveOrderRequest } from "@/lib/orders";
import { openRazorpayCheckout } from "@/lib/payment/checkout-widget";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import type { PaymentMethod } from "@/lib/payment/types";
import {
  areaLabel,
  assessPincode,
  cityLabel,
  composeDeliveryAddress,
  normalizeEmail,
  pincodeStatusText,
  type PincodeDelivery,
  validateDeliveryAddress,
} from "@/lib/service-area";
import { formatInr } from "@/lib/shop";
import type { CartLine, Locale } from "@/lib/types";
import { cartWhatsAppUrl } from "@/lib/whatsapp";
import { CartPanel } from "@/components/CartPanel";
import { CheckoutConfirmation } from "@/components/CheckoutConfirmation";
import { useAuth, useCart, useDeliveryLocation, useLanguage } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";

const steps = [
  "checkout.flowCart",
  "checkout.flowPincode",
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

function readInvoiceMail(value: unknown): { shop: boolean; customer: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const mail = (value as { invoiceMail?: { shop?: unknown; customer?: unknown } }).invoiceMail;
  if (!mail || typeof mail.shop !== "boolean" || typeof mail.customer !== "boolean") return null;
  return { shop: mail.shop, customer: mail.customer };
}

function readReview(value: unknown): CheckoutReview | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { ok?: boolean; order?: OrderRequest; issues?: unknown; delivery?: PincodeDelivery };
  if (record.ok === true && record.order) return { ok: true, order: record.order };
  if (record.ok === false && Array.isArray(record.issues) && record.delivery && typeof record.delivery === "object") {
    return { ok: false, issues: record.issues.filter((issue) => typeof issue === "string"), delivery: record.delivery };
  }
  if (record.ok === false && Array.isArray(record.issues)) {
    return { ok: false, issues: record.issues.filter((issue) => typeof issue === "string"), delivery: { status: "invalid" } };
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
  const { confirmed, confirm, clearLocation } = useDeliveryLocation();
  const { user } = useAuth();
  const edited = useRef(false);
  const prefilled = useRef(false);
  const savedLabel = useRef("");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.mobile ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [pincode, setPincode] = useState("");
  const [door, setDoor] = useState("");
  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noticeKey, setNoticeKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderRequest | null>(null);
  const [invoiceMail, setInvoiceMail] = useState<{ shop: boolean; customer: boolean } | null>(null);
  const [razorpayMode, setRazorpayMode] = useState<"test" | "live" | null>(null);
  const assessed = assessPincode(pincode);
  const address = { name, door, building, street, locality, phone, email, pincode };
  const fieldErrors = validateDeliveryAddress(address, locale);
  const addressReady = assessed.status === "available" && Object.keys(fieldErrors).length === 0;
  const allowed = addressReady && lines.length > 0 && method !== "";
  const provider = createUnconfiguredPaymentProvider();
  const productSubtotal = subtotal(lines);
  const fee = deliveryFee(assessed, deliveryConfig);
  const total = cartTotal(productSubtotal, fee);
  const feeLabel = assessed.status === "available" && fee === 0 ? t(locale, "cart.freeDelivery") : pincodeStatusText(assessed, locale);
  const fallbackAddress =
    assessed.status === "available"
      ? addressReady
        ? composeDeliveryAddress(address, locale)
        : `${areaLabel(assessed, locale)}, ${cityLabel(locale, assessed)} ${assessed.pincode}`
      : "";
  const fallbackHref = cartWhatsAppUrl(locale, name, lines, fallbackAddress);
  const statusClass = assessed.status === "available" ? "notice" : assessed.status === "required" ? "muted" : "error";

  useEffect(() => {
    if (!user || edited.current) return;
    setName(user.name);
    setPhone(user.mobile);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (prefilled.current || !confirmed?.pincode) return;
    prefilled.current = true;
    setPincode((current) => current || confirmed.pincode);
  }, [confirmed]);

  useEffect(() => {
    if (assessed.status !== "available") return;
    const label = addressReady
      ? composeDeliveryAddress(address, locale)
      : `${areaLabel(assessed, locale)}, ${cityLabel(locale, assessed)} ${assessed.pincode}`;
    const token = `${assessed.pincode}|${label}`;
    if (savedLabel.current === token) return;
    savedLabel.current = token;
    confirm({
      source: "pincode",
      pincode: assessed.pincode,
      areasEnglish: assessed.areasEnglish,
      areasTamil: assessed.areasTamil,
      addressLabel: label,
      confirmedAt: new Date().toISOString(),
    });
  }, [address, addressReady, assessed, confirm, locale]);

  useEffect(() => {
    if (assessed.status !== "unavailable") return;
    savedLabel.current = "";
    clearLocation();
  }, [assessed, clearLocation]);

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
    const fresh = assessPincode(pincode);
    const nextErrors = validateDeliveryAddress(address, locale);
    if (!method) nextErrors.method = t(locale, "validation.methodRequired");
    if (lines.length === 0) nextErrors.cart = t(locale, "checkout.empty");
    if (fresh.status !== "available") nextErrors.delivery = pincodeStatusText(fresh, locale);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !method || fresh.status !== "available") return;

    setSubmitting(true);
    try {
      const draft = {
        locale,
        customer: {
          name,
          mobile: phone,
          door,
          building,
          street,
          locality,
          email,
          pincode: fresh.pincode,
        },
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
          email: normalizeEmail(email),
          contact: phone,
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
      const payload = await response.json();
      const review = readReview(payload);
      if (!review || !isAccepted(review)) {
        const rejected = validateDeliveryAddress(address, locale);
        const issues = review && !review.ok ? review.issues : ["invalid"];
        if (issues.includes("email") && !rejected.email) rejected.email = t(locale, "validation.emailInvalid");
        if (issues.includes("method")) rejected.method = t(locale, "validation.methodRequired");
        if (issues.includes("empty")) rejected.cart = t(locale, "checkout.empty");
        if (issues.includes("delivery") && review && !review.ok) {
          rejected.delivery = pincodeStatusText(review.delivery, locale);
        }
        if (issues.includes("payment") || issues.includes("invalid")) rejected.payment = t(locale, "payment.notConfigured");
        setErrors(rejected);
        setNoticeKey("checkout.paymentNotTaken");
        return;
      }
      saveOrderRequest(window.localStorage, review.order);
      setInvoiceMail(readInvoiceMail(payload));
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
        <CheckoutConfirmation order={order} locale={locale} invoiceMail={invoiceMail} />
      ) : (
        <form className="stack" noValidate onSubmit={onSubmit}>
          {lines.length === 0 && !noticeKey ? <p>{t(locale, "checkout.empty")}</p> : null}
          <section className="stack" data-checkout-step="cart">
            <SectionHeading title={t(locale, "cart.title")} />
            <CartPanel showCheckoutLink={false} />
          </section>
          <section className="stack" data-checkout-step="pincode">
            <SectionHeading title={t(locale, "checkout.pincodeTitle")} />
            <div className="pincode-check">
              <FormField label={t(locale, "forms.pincode")} error={errors.pincode}>
                <input
                  value={pincode}
                  data-testid="delivery-pincode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  onChange={(event) => {
                    edited.current = true;
                    setPincode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setErrors((current) => ({ ...current, pincode: "", delivery: "" }));
                  }}
                />
              </FormField>
              <Button
                type="button"
                variant="secondary"
                data-testid="check-pincode"
                onClick={() => setPincode((current) => current.replace(/\D/g, "").slice(0, 6))}
              >
                {t(locale, "forms.checkPincode")}
              </Button>
            </div>
            <p data-testid="checkout-delivery" className={statusClass}>
              {errors.delivery || pincodeStatusText(assessed, locale)}
            </p>
            <p>{t(locale, "checkout.recheck")}</p>
          </section>
          {assessed.status === "available" ? (
            <section className="stack" data-checkout-step="address">
              <SectionHeading title={t(locale, "checkout.deliveryAddress")} />
              <FormField label={t(locale, "forms.name")} error={errors.name}>
                <input data-testid="address-name" value={name} autoComplete="name" onChange={(event) => edit(setName)(event.target.value)} />
              </FormField>
              <FormField label={t(locale, "forms.door")} error={errors.door}>
                <input data-testid="address-door" value={door} autoComplete="address-line1" onChange={(event) => edit(setDoor)(event.target.value)} />
              </FormField>
              <FormField label={t(locale, "forms.building")} error={errors.building}>
                <input data-testid="address-building" value={building} autoComplete="address-line2" onChange={(event) => edit(setBuilding)(event.target.value)} />
              </FormField>
              <FormField label={t(locale, "forms.street")} error={errors.street}>
                <input data-testid="address-street" value={street} autoComplete="address-line3" onChange={(event) => edit(setStreet)(event.target.value)} />
              </FormField>
              <FormField label={t(locale, "forms.locality")} error={errors.locality}>
                <input data-testid="address-locality" value={locality} autoComplete="address-level3" onChange={(event) => edit(setLocality)(event.target.value)} />
              </FormField>
              <FormField label={t(locale, "forms.city")}>
                <input data-testid="address-city" value={cityLabel(locale, assessed)} readOnly autoComplete="address-level2" />
              </FormField>
              <FormField label={t(locale, "forms.pincode")}>
                <input data-testid="address-pincode" value={assessed.pincode} readOnly autoComplete="postal-code" />
              </FormField>
              <FormField label={t(locale, "forms.phone")} error={errors.mobile}>
                <input
                  data-testid="address-phone"
                  type="tel"
                  value={phone}
                  autoComplete="tel"
                  inputMode="numeric"
                  onChange={(event) => edit(setPhone)(event.target.value)}
                />
              </FormField>
              <FormField label={t(locale, "forms.email")} error={errors.email || (email.trim() && fieldErrors.email ? fieldErrors.email : "")}>
                <input
                  data-testid="address-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(event) => {
                    edit(setEmail)(event.target.value);
                    setErrors((current) => ({ ...current, email: "" }));
                  }}
                />
              </FormField>
              <p className="muted" data-testid="email-for-invoice">{t(locale, "checkout.emailForInvoice")}</p>
              {addressReady ? null : <p className="muted">{t(locale, "checkout.addressNext")}</p>}
            </section>
          ) : null}
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
          {addressReady ? (
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
          ) : null}
          <Button type="submit" data-testid="checkout-submit" disabled={!allowed || submitting}>
            {razorpayMode && method && onlineMethods.has(method) ? t(locale, "checkout.continueRazorpay") : t(locale, "checkout.placeRequest")}
          </Button>
          {!addressReady ? <p>{t(locale, "checkout.blocked")}</p> : null}
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
