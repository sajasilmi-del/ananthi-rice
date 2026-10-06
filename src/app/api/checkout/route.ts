import { reviewCheckout } from "@/lib/checkout-review";
import { resolveDeliveryConfig } from "@/lib/delivery";
import { readRazorpayConfig, verifyRazorpayPayment, type RazorpayProof } from "@/lib/payment/razorpay";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";
import type { PaymentMethod } from "@/lib/payment/types";

function readProof(value: unknown): RazorpayProof | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.orderId !== "string" || typeof record.paymentId !== "string" || typeof record.signature !== "string") {
    return null;
  }
  return { orderId: record.orderId, paymentId: record.paymentId, signature: record.signature };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, issues: ["invalid"] }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, issues: ["invalid"] }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const config = readRazorpayConfig();
  const method = typeof record.method === "string" ? record.method : "";
  const online = method === "upi" || method === "card" || method === "netbanking";
  const proof = readProof(record.razorpay);
  const review = await reviewCheckout({
    draft: body,
    config: resolveDeliveryConfig(),
    provider: createUnconfiguredPaymentProvider(),
    confirmPayment:
      config && online
        ? ({ totalPaise, method: confirmedMethod }) => {
            if (!proof) return Promise.resolve(null);
            return verifyRazorpayPayment({
              config,
              proof,
              amountPaise: totalPaise,
              method: confirmedMethod as Exclude<PaymentMethod, "cod">,
            });
          }
        : undefined,
  });
  return Response.json(review);
}
