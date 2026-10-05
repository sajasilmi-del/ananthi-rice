import { addLine, cartTotal, deliveryFee, lineAmount, subtotal } from "@/lib/cart";
import { getProduct, getVariant } from "@/lib/catalog";
import { checkoutAllowed, evaluateDelivery, isValidLatLng } from "@/lib/delivery";
import type { DeliveryResult } from "@/lib/delivery";
import type { OrderLine, OrderRequest } from "@/lib/orders";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import { PAYMENT_METHODS, type PaymentMethod, type PaymentProvider } from "@/lib/payment/types";
import type { CartLine, ConfirmedLocation, DeliveryConfig } from "@/lib/types";
import { validateCustomer } from "@/lib/validation";

export type CheckoutReview =
  | { ok: true; order: OrderRequest }
  | { ok: false; issues: string[]; delivery: DeliveryResult };

const locationSources = new Set(["browser", "map", "address"]);

function readCustomer(value: unknown): { name: string; mobile: string; email: string; address: string } {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    name: typeof record.name === "string" ? record.name : "",
    mobile: typeof record.mobile === "string" ? record.mobile : "",
    email: typeof record.email === "string" ? record.email : "",
    address: typeof record.address === "string" ? record.address : "",
  };
}

function readLocation(value: unknown): ConfirmedLocation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!isValidLatLng({ latitude, longitude })) return null;
  if (typeof record.source !== "string" || !locationSources.has(record.source)) return null;
  return {
    latitude,
    longitude,
    source: record.source as ConfirmedLocation["source"],
    addressLabel: typeof record.addressLabel === "string" ? record.addressLabel : "",
    confirmedAt: typeof record.confirmedAt === "string" ? record.confirmedAt : "",
  };
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

/**
 * Re-checks the cart, customer, 5 km delivery rule, and payment provider.
 * Client flags, prices, and payment claims are ignored.
 */
export async function reviewCheckout(options: {
  draft: unknown;
  config: DeliveryConfig;
  provider?: PaymentProvider;
  now?: () => string;
  createId?: () => string;
}): Promise<CheckoutReview> {
  const record = options.draft && typeof options.draft === "object" ? (options.draft as Record<string, unknown>) : {};
  const customer = readCustomer(record.customer);
  const location = readLocation(record.location);
  const lines = readLines(record.lines);
  const delivery = evaluateDelivery(options.config, location);
  const issues: string[] = [];
  const fieldErrors = validateCustomer(customer, "en", { password: false });
  issues.push(...Object.keys(fieldErrors));
  if (!location) issues.push("location");
  if (lines.length === 0) issues.push("empty");
  if (!checkoutAllowed(delivery)) issues.push("delivery");
  const method = typeof record.method === "string" ? record.method : "";
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) issues.push("method");
  if (!location || issues.length > 0 || delivery.status !== "available") {
    return { ok: false, issues, delivery };
  }

  const provider = options.provider ?? createUnconfiguredPaymentProvider();
  let intent: { status?: string; reason?: string; method?: string } | null = null;
  try {
    intent = await provider.createIntent(method as PaymentMethod);
  } catch {
    intent = null;
  }
  if (!paymentUnconfirmed(intent)) {
    return { ok: false, issues: ["payment"], delivery };
  }

  const productSubtotal = subtotal(lines);
  const fee = deliveryFee(delivery, options.config);
  return {
    ok: true,
    order: {
      id: (options.createId ?? (() => crypto.randomUUID()))(),
      createdAt: (options.now ?? (() => new Date().toISOString()))(),
      customer: {
        name: customer.name.trim(),
        mobile: customer.mobile.replace(/\s+/g, ""),
        email: customer.email.trim(),
        address: customer.address.trim(),
      },
      location,
      distanceKm: delivery.distanceKm,
      lines: orderLines(lines),
      subtotal: productSubtotal,
      deliveryFee: fee,
      total: cartTotal(productSubtotal, fee),
      payment: {
        method: method as PaymentMethod,
        status: "not_confirmed",
        reason: "provider_not_configured",
      },
      status: "request_only",
    },
  };
}
