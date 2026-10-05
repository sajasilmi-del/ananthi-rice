import { reviewCheckout } from "@/lib/checkout-review";
import { resolveDeliveryConfig } from "@/lib/delivery";
import { createUnconfiguredPaymentProvider } from "@/lib/payment/unconfigured";

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
  const review = await reviewCheckout({
    draft: body,
    config: resolveDeliveryConfig(),
    provider: createUnconfiguredPaymentProvider(),
  });
  return Response.json(review);
}
