import { getProduct, getVariant, productName, site, variantPackLabel } from "@/lib/catalog";
import { deliveryStatusText } from "@/lib/delivery";
import { t } from "@/lib/i18n";
import type { CartLine, Locale } from "@/lib/types";

export type WhatsAppLine = {
  name: string;
  packSize: string;
  quantity: number;
};

export type WhatsAppOrder = {
  customerName: string;
  lines: WhatsAppLine[];
  cartTotal?: string;
  deliveryLocation: string;
  orderId?: string;
};

const COORDINATES = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;
const INTERNAL_ADDRESS = /provider_not_configured|request_only|origin_not_configured|not configured|அமைக்கப்படவில்லை/i;

export function customerDeliveryAddress(value: string | null | undefined): string {
  const label = value?.trim() ?? "";
  if (!label || COORDINATES.test(label) || INTERNAL_ADDRESS.test(label)) return "";
  return label;
}

export function linesFromCart(lines: CartLine[], locale: Locale): WhatsAppLine[] {
  return lines.flatMap((line) => {
    const product = getProduct(line.productId);
    const variant = product ? getVariant(product, line.variantId) : undefined;
    if (!product || !variant) return [];
    return [
      {
        name: productName(product, locale),
        packSize: variantPackLabel(variant, locale) ?? "",
        quantity: line.quantity,
      },
    ];
  });
}

export function buildWhatsAppMessage(locale: Locale, order: WhatsAppOrder): string {
  const blank = t(locale, "whatsapp.notProvided");
  const lines = order.lines.length > 0 ? order.lines : [{ name: "", packSize: "", quantity: 0 }];
  const blocks = lines.map((line) =>
    [
      `${t(locale, "whatsapp.product")}: ${line.name.trim() || blank}`,
      `${t(locale, "whatsapp.packSize")}: ${line.packSize.trim() || blank}`,
      `${t(locale, "whatsapp.quantity")}: ${line.quantity > 0 ? line.quantity : blank}`,
    ].join("\n"),
  );
  return [
    t(locale, "whatsapp.intro"),
    "",
    t(locale, "whatsapp.intent"),
    "",
    blocks.join("\n\n"),
    "",
    `${t(locale, "whatsapp.customer")}: ${order.customerName.trim() || blank}`,
    `${t(locale, "whatsapp.deliveryAddress")}: ${customerDeliveryAddress(order.deliveryLocation) || blank}`,
    "",
    t(locale, "whatsapp.closing"),
  ].join("\n");
}

export function buildWhatsAppUrl(locale: Locale, order: WhatsAppOrder): string {
  const text = buildWhatsAppMessage(locale, order);
  return `https://wa.me/${site.whatsappE164}?text=${encodeURIComponent(text)}`;
}

export function cartWhatsAppUrl(
  locale: Locale,
  customerName: string,
  lines: CartLine[],
  addressLabel: string | null | undefined,
): string {
  return buildWhatsAppUrl(locale, {
    customerName,
    lines: linesFromCart(lines, locale),
    deliveryLocation: addressLabel ?? "",
  });
}

export function availableTemplate(locale: Locale, distanceKm: number): string {
  return deliveryStatusText({ status: "available", distanceKm }, locale);
}
