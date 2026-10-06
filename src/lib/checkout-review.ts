import { addLine, cartTotal, deliveryFee, lineAmount, subtotal } from "@/lib/cart";
import { getProduct, getVariant } from "@/lib/catalog";
import type { OrderLine, OrderRequest } from "@/lib/orders";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import { PAYMENT_METHODS, type PaymentIntent, type PaymentMethod, type PaymentProvider } from "@/lib/payment/types";
import {
  assessPincode,
  composeDeliveryAddress,
  normalizePhone,
  type DeliveryAddressInput,
  type PincodeDelivery,
  validateDeliveryAddress,
} from "@/lib/service-area";
import type { CartLine, DeliveryConfig, Locale } from "@/lib/types";

export type CheckoutReview =
  | { ok: true; order: OrderRequest }
  | { ok: false; issues: string[]; delivery: PincodeDelivery };

function text(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readAddress(value: unknown): DeliveryAddressInput {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const mobile = text(record, "mobile");
  return {
    name: text(record, "name"),
    door: text(record, "door"),
    building: text(record, "building"),
    street: text(record, "street"),
    locality: text(record, "locality"),
    phone: mobile || text(record, "phone"),
    pincode: text(record, "pincode"),
  };
}

function readLocale(value: unknown): Locale {
  return value === "ta" ? "ta" : "en";
}

function readLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  let lines: CartLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.productId !== "string" || typeof record.variantId !== "string") continue;
    if (typeof record.quantity !== "number") continue;
    lines = addLine(lines, {
      productId: record.productId,
      variantId: record.variantId,
      quantity: record.quantity,
    });
  }
  return lines;
}

function orderLines(lines: CartLine[]): OrderLine[] {
  return lines.flatMap((line) => {
    const product = getProduct(line.productId);
    const variant = product ? getVariant(product, line.variantId) : undefined;
    if (!product || !variant) return [];
    return [
      {
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        nameEnglish: product.nameEnglish,
        nameTamil: product.nameTamil,
        packEnglish: variant.packSize,
        packTamil: variant.packSizeTamil,
        lineTotal: lineAmount(line),
      },
    ];
  });
}

function paymentUnconfirmed(intent: { status?: string; reason?: string; method?: string } | null): intent is {
  method: PaymentMethod;
  status: "not_confirmed";
  reason: "provider_not_configured";
} {
  return intent?.status === "not_confirmed" && intent.reason === "provider_not_configured" && typeof intent.method === "string";
}

export type CheckoutQuote =
  | { ok: false; issues: string[]; delivery: PincodeDelivery }
  | {
      ok: true;
      customer: { name: string; mobile: string; email: string; address: string };
      serviceArea: OrderRequest["serviceArea"];
      lines: CartLine[];
      delivery: Extract<PincodeDelivery, { status: "available" }>;
      method: PaymentMethod;
      subtotal: number;
      fee: number;
      total: number;
    };

export function prepareCheckout(draft: unknown, config: DeliveryConfig): CheckoutQuote {
  const record = draft && typeof draft === "object" ? (draft as Record<string, unknown>) : {};
  const address = readAddress(record.customer);
  const locale = readLocale(record.locale);
  const lines = readLines(record.lines);
  const delivery = assessPincode(address.pincode);
  const issues: string[] = [];
  const fieldErrors = validateDeliveryAddress(address, "en");
  issues.push(...Object.keys(fieldErrors));
  if (lines.length === 0) issues.push("empty");
  if (delivery.status !== "available") issues.push("delivery");
  const method = typeof record.method === "string" ? record.method : "";
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) issues.push("method");
  if (issues.length > 0 || delivery.status !== "available") {
    return { ok: false, issues, delivery };
  }
  const productSubtotal = subtotal(lines);
  const fee = deliveryFee(delivery, config);
  const total = cartTotal(productSubtotal, fee);
  if (productSubtotal == null || fee == null || total == null) {
    return { ok: false, issues: ["payment"], delivery };
  }
  return {
    ok: true,
    customer: {
      name: address.name.trim(),
      mobile: normalizePhone(address.phone),
      email: "",
      address: composeDeliveryAddress(address, locale),
    },
    serviceArea: {
      source: "pincode",
      pincode: delivery.pincode,
      areasEnglish: delivery.areasEnglish,
      areasTamil: delivery.areasTamil,
    },
    lines,
    delivery,
    method: method as PaymentMethod,
    subtotal: productSubtotal,
    fee,
    total,
  };
}

/**
 * Re-checks the cart, Chennai pincode, delivery address, and payment provider.
 * Client coordinates, composed address text, prices, and payment claims are ignored.
 */
export async function reviewCheckout(options: {
  draft: unknown;
  config: DeliveryConfig;
  provider?: PaymentProvider;
  confirmPayment?: (quote: { totalPaise: number; method: Exclude<PaymentMethod, "cod"> }) => Promise<PaymentIntent | null>;
  now?: () => string;
  createId?: () => string;
}): Promise<CheckoutReview> {
  const quote = prepareCheckout(options.draft, options.config);
  if (!quote.ok) return quote;

  let payment: PaymentIntent;
  if (options.confirmPayment && quote.method !== "cod") {
    const confirmed = await options.confirmPayment({
      totalPaise: Math.round(quote.total * 100),
      method: quote.method,
    });
    if (!confirmed || confirmed.status !== "captured" || confirmed.method !== quote.method) {
      return { ok: false, issues: ["payment"], delivery: quote.delivery };
    }
    payment = confirmed;
  } else {
    const provider = options.provider ?? createUnconfiguredPaymentProvider();
    let intent: { status?: string; reason?: string; method?: string } | null = null;
    try {
      intent = await provider.createIntent(quote.method);
    } catch {
      intent = null;
    }
    if (!paymentUnconfirmed(intent)) {
      return { ok: false, issues: ["payment"], delivery: quote.delivery };
    }
    payment = {
      method: quote.method,
      status: "not_confirmed",
      reason: "provider_not_configured",
    };
  }

  return {
    ok: true,
    order: {
      id: (options.createId ?? (() => crypto.randomUUID()))(),
      createdAt: (options.now ?? (() => new Date().toISOString()))(),
      customer: quote.customer,
      serviceArea: quote.serviceArea,
      lines: orderLines(quote.lines),
      subtotal: quote.subtotal,
      deliveryFee: quote.fee,
      total: quote.total,
      payment,
      status: payment.status === "captured" ? "paid" : "request_only",
    },
  };
}
