import { getProduct, getVariant, site } from "@/lib/catalog";
import type { OrderRequest } from "@/lib/orders";
import { formatInr } from "@/lib/shop";
import type { CartLine } from "@/lib/types";

const NOTE_VALUE_LIMIT = 255;

function clip(value: string, max = NOTE_VALUE_LIMIT): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim();
}

function productLabel(line: CartLine): string | null {
  const product = getProduct(line.productId);
  const variant = product ? getVariant(product, line.variantId) : undefined;
  if (!product || !variant) return null;
  const pack = variant.packSize ? ` ${variant.packSize}` : "";
  return clip(`${line.quantity}x ${product.nameEnglish}${pack}`);
}

export function shopOrderNotes(input: {
  name: string;
  phone: string;
  email: string;
  address: string;
  area: string;
  pincode: string;
  method: string;
  total: number;
  lines: CartLine[];
}): Record<string, string> {
  const labels = input.lines.flatMap((line) => {
    const label = productLabel(line);
    return label ? [label] : [];
  });
  const chunks: string[] = [];
  let current = "";
  for (const label of labels) {
    const next = current ? `${current}; ${label}` : label;
    if (next.length > NOTE_VALUE_LIMIT) {
      if (current) chunks.push(current);
      current = label;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const notes: Record<string, string> = {
    name: clip(input.name, 120),
    phone: clip(input.phone, 20),
    email: clip(input.email, 120),
    address: clip(input.address),
    area: clip(`${input.area} ${input.pincode}`),
    total: clip(`INR ${input.total} ${input.method}`, 80),
  };
  for (const [index, chunk] of chunks.slice(0, 9).entries()) {
    notes[`items${index + 1}`] = chunk;
  }
  return Object.fromEntries(Object.entries(notes).filter(([, value]) => value.length > 0));
}

export function shopOrderMessage(order: OrderRequest): string {
  const payment = order.payment;
  const paid = payment.status === "captured";
  const products = order.lines.map((line) => {
    const pack = line.packEnglish ? ` (${line.packEnglish})` : "";
    const amount = line.lineTotal == null ? "" : ` — ${formatInr(line.lineTotal, "en")}`;
    return `${line.quantity} × ${line.nameEnglish}${pack}${amount}`;
  });
  const paymentLines = paid
    ? [
        `Payment reference: ${payment.razorpayPaymentId}`,
        `Razorpay order: ${payment.razorpayOrderId}`,
        `Method: ${payment.method}`,
      ]
    : ["Payment: Cash on delivery. Not paid online."];
  return [
    paid ? "ANANTHI RICE paid order" : "ANANTHI RICE cash on delivery order",
    "",
    `Order: ${order.id}`,
    ...paymentLines,
    ...(order.total == null ? [] : [`Total: ${formatInr(order.total, "en")}`]),
    "",
    `Customer: ${order.customer.name}`,
    `Phone: ${order.customer.mobile}`,
    `Email: ${order.customer.email}`,
    `Address: ${order.customer.address}`,
    `Area: ${order.serviceArea.areasEnglish} (${order.serviceArea.pincode})`,
    "",
    "Products:",
    ...(products.length > 0 ? products : ["None"]),
  ].join("\n");
}

export function shopOrderWhatsAppUrl(order: OrderRequest): string {
  return `https://wa.me/${site.whatsappE164}?text=${encodeURIComponent(shopOrderMessage(order))}`;
}
