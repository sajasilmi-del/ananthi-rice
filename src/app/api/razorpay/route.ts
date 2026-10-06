import { prepareCheckout } from "@/lib/checkout-review";
import { resolveDeliveryConfig } from "@/lib/delivery";
import { createRazorpayOrder, readRazorpayConfig } from "@/lib/payment/razorpay";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = readRazorpayConfig();
  if (!config) return Response.json({ enabled: false, mode: null });
  return Response.json({ enabled: true, mode: config.mode });
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
