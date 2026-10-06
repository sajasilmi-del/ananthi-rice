import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { getProduct } from "@/lib/catalog";
import { reviewCheckout } from "@/lib/checkout-review";
import { pointDueNorth } from "@/lib/delivery";
import { PAYMENT_METHODS, type PaymentIntent, type PaymentMethod, type PaymentProvider } from "@/lib/payment/types";
import type { DeliveryConfig } from "@/lib/types";

const origin = { latitude: 9.5, longitude: 78.6 };
const config: DeliveryConfig = {
  enabled: true,
  radiusKm: 5,
  origin,
  feeWhenAvailableInr: 0,
};
const customer = {
  name: "Anand",
  mobile: "9876543210",
  email: "anand@example.com",
  address: "Paramakudi",
};

function location(distanceKm: number) {
  return {
    ...pointDueNorth(origin, distanceKm),
    source: "map" as const,
    addressLabel: "Pin",
    confirmedAt: "2026-10-03T00:00:00.000Z",
  };
}

function draft(distanceKm: number, extra: Record<string, unknown> = {}) {
  return {
    customer,
    location: location(distanceKm),
    lines: [{ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 2, nameEnglish: "Fake name" }],
    method: "upi",
    payment: { status: "paid", reason: "captured" },
    eligible: true,
    subtotal: 999,
    ...extra,
  };
}

describe("checkout review", () => {
  it("accepts an in-range order without taking payment or inventing a price", async () => {
    const review = await reviewCheckout({
      draft: draft(4),
      config,
      createId: () => "order-1",
      now: () => "2026-10-03T00:00:00.000Z",
    });
    expect(review.ok).toBe(true);
    if (!review.ok) return;
    const product = getProduct("ponni-boiled-rice");
    expect(review.order.id).toBe("order-1");
    expect(review.order.status).toBe("request_only");
    expect(review.order.payment).toEqual({ method: "upi", status: "not_confirmed", reason: "provider_not_configured" });
    expect(review.order.customer).toEqual(customer);
    expect(review.order.distanceKm).toBeCloseTo(4, 5);
    expect(review.order.subtotal).toBe(320);
    expect(review.order.deliveryFee).toBe(0);
    expect(review.order.total).toBe(320);
    expect(review.order.lines[0]).toMatchObject({
      productId: "ponni-boiled-rice",
      variantId: "1kg",
      quantity: 2,
      nameEnglish: product?.nameEnglish,
      nameTamil: product?.nameTamil,
      lineTotal: 320,
    });
    expect(review.order.subtotal).not.toBe(999);
    expect(JSON.stringify(review.order)).not.toContain("paid");
    expect(JSON.stringify(review.order)).not.toContain("Fake name");
  });

  it("rejects a pin outside 5 km, an empty cart, and a payment result that is not the unconfigured state", async () => {
    const outside = await reviewCheckout({ draft: draft(5.01), config });
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.issues).toContain("delivery");

    const empty = await reviewCheckout({ draft: draft(4, { lines: [] }), config });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.issues).toContain("empty");

    const liar: PaymentProvider = {
      configured: false,
      listMethods: () => PAYMENT_METHODS,
      async createIntent(method: PaymentMethod): Promise<PaymentIntent> {
        return { method, status: "captured", reason: "ok" } as unknown as PaymentIntent;
      },
    };
    const paid = await reviewCheckout({ draft: draft(4), config, provider: liar });
    expect(paid).toMatchObject({ ok: false, issues: ["payment"] });
  });

  it("keeps an order unavailable when the server origin is not configured", async () => {
    const review = await reviewCheckout({
      draft: draft(0.5),
      config: { ...config, origin: { latitude: null, longitude: null } },
    });
    expect(review.ok).toBe(false);
    if (!review.ok) {
      expect(review.delivery.status).toBe("origin_not_configured");
      expect(review.issues).toContain("delivery");
    }
  });
});

describe("checkout route", () => {
  it("rejects a malformed body and does not accept a client payment claim", async () => {
    const malformed = await POST(new Request("http://localhost/api/checkout", { method: "POST", body: "nope" }));
    expect(malformed.status).toBe(400);

    const previousLatitude = process.env.DELIVERY_ORIGIN_LATITUDE;
    const previousLongitude = process.env.DELIVERY_ORIGIN_LONGITUDE;
    process.env.DELIVERY_ORIGIN_LATITUDE = "";
    process.env.DELIVERY_ORIGIN_LONGITUDE = "";
    try {
      const response = await POST(
        new Request("http://localhost/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft(1)),
        }),
      );
      const body = (await response.json()) as { ok: boolean; order?: { payment?: { status?: string } } };
      expect(response.status).toBe(200);
      expect(body.ok).toBe(false);
      expect(body.order).toBeUndefined();
    } finally {
      if (previousLatitude === undefined) delete process.env.DELIVERY_ORIGIN_LATITUDE;
      else process.env.DELIVERY_ORIGIN_LATITUDE = previousLatitude;
      if (previousLongitude === undefined) delete process.env.DELIVERY_ORIGIN_LONGITUDE;
      else process.env.DELIVERY_ORIGIN_LONGITUDE = previousLongitude;
    }
  });
});
