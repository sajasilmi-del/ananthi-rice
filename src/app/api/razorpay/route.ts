import { prepareCheckout } from "@/lib/checkout-review";
import { resolveDeliveryConfig } from "@/lib/delivery";
import { createRazorpayOrder, readRazorpayConfig, readRazorpayStatus } from "@/lib/payment/razorpay";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment/types";
import { shopOrderNotes } from "@/lib/shop-notice";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = readRazorpayStatus();
  if (!status.enabled) return Response.json(status);
  return Response.json({ enabled: true, mode: status.mode });
}

export async function POST(request: Request) {
  const config = readRazorpayConfig();
  if (!config) return Response.json({ ok: false, issues: ["payment"] }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, issues: ["invalid"] }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const method = typeof record.method === "string" ? record.method : "";
  if (!PAYMENT_METHODS.includes(method as PaymentMethod) || method === "cod") {
    return Response.json({ ok: false, issues: ["method"] }, { status: 400 });
  }

  const quote = prepareCheckout(body, resolveDeliveryConfig());
  if (!quote.ok) return Response.json(quote);
  const amountPaise = Math.round(quote.total * 100);
  const order = await createRazorpayOrder({
    config,
    amountPaise,
    receipt: crypto.randomUUID(),
    notes: shopOrderNotes({
      name: quote.customer.name,
      phone: quote.customer.mobile,
      email: quote.customer.email,
      address: quote.customer.address,
      area: quote.serviceArea.areasEnglish,
      pincode: quote.serviceArea.pincode,
      method: quote.method,
      total: quote.total,
      lines: quote.lines,
    }),
  });
  if (!order) return Response.json({ ok: false, issues: ["payment"], delivery: quote.delivery }, { status: 502 });
  return Response.json({
    ok: true,
    keyId: config.keyId,
    orderId: order.orderId,
    amount: order.amount,
    currency: order.currency,
  });
}
