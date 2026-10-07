import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { getProduct } from "@/lib/catalog";
import { reviewCheckout } from "@/lib/checkout-review";
import { PAYMENT_METHODS, type PaymentIntent, type PaymentMethod, type PaymentProvider } from "@/lib/payment/types";
import type { DeliveryConfig } from "@/lib/types";

const config: DeliveryConfig = {
  enabled: true,
  radiusKm: 5,
  origin: { latitude: 9.5, longitude: 78.6 },
  feeWhenAvailableInr: 0,
};

function draft(pincode = "600089", extra: Record<string, unknown> = {}) {
  return {
    locale: "en",
    customer: {
      name: "Anand",
      mobile: "9876543210",
      email: "anand@example.com",
      address: "Paramakudi",
      door: "12",
      building: "Hillcrest",
      street: "2nd Main Road",
      locality: "Ramapuram",
      city: "Mumbai",
      pincode,
    },
    location: {
      latitude: 13.0280447,
      longitude: 80.1868165,
      source: "map",
      addressLabel: "Pin",
      confirmedAt: "2026-10-03T00:00:00.000Z",
    },
    lines: [{ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 2, nameEnglish: "Fake name" }],
    method: "upi",
    payment: { status: "paid", reason: "captured" },
    eligible: true,
    subtotal: 999,
    ...extra,
  };
}

describe("checkout review", () => {
  it("accepts a listed Chennai pincode and ignores the client address, price, and payment claim", async () => {
    const review = await reviewCheckout({
      draft: draft(),
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
    expect(review.order.customer).toEqual({
      name: "Anand",
      mobile: "9876543210",
      email: "anand@example.com",
      address: "12, Hillcrest, 2nd Main Road, Ramapuram, Chennai 600089, 9876543210",
    });
    expect(review.order.customer.address).not.toContain("@");
    expect(review.order.serviceArea).toEqual({
      source: "pincode",
      pincode: "600089",
      areasEnglish: "Ramapuram, Nandambakkam",
      areasTamil: "இராமபுரம், நந்தம்பாக்கம்",
    });
    expect(review.order).not.toHaveProperty("distanceKm");
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
    const saved = JSON.stringify(review.order);
    expect(saved).not.toContain("999");
    expect(saved).not.toContain("Fake name");
    expect(saved).not.toContain("Paramakudi");
    expect(saved).not.toContain("Mumbai");
    expect(saved).toContain("anand@example.com");
    expect(saved).not.toContain("paid");
  });

  it("requires an email before payment and stores it in lower case", async () => {
    const base = draft().customer as Record<string, unknown>;
    const missing = await reviewCheckout({
      draft: draft("600089", { customer: { ...base, email: "  " } }),
      config,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues).toContain("email");

    const invalid = await reviewCheckout({
      draft: draft("600089", { customer: { ...base, email: "not-an-email" } }),
      config,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.issues).toContain("email");

    const review = await reviewCheckout({
      draft: draft("600089", { customer: { ...base, email: " Anand@Example.com " } }),
      config,
    });
    expect(review.ok).toBe(true);
    if (review.ok) expect(review.order.customer.email).toBe("anand@example.com");
  });

  it("rejects a pincode outside Chennai, an empty cart, and a payment result that is not the unconfigured state", async () => {
    const outside = await reviewCheckout({ draft: draft("623707"), config });
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.issues).toContain("delivery");
      expect(outside.delivery.status).toBe("unavailable");
    }

    const gpsOnly = await reviewCheckout({
      draft: draft("600089", { customer: { name: "Anand", mobile: "9876543210", address: "Near the shop" } }),
      config,
    });
    expect(gpsOnly.ok).toBe(false);
    if (!gpsOnly.ok) expect(gpsOnly.issues).toContain("delivery");

    const empty = await reviewCheckout({ draft: draft("600089", { lines: [] }), config });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.issues).toContain("empty");

    const liar: PaymentProvider = {
      configured: false,
      listMethods: () => PAYMENT_METHODS,
      async createIntent(method: PaymentMethod): Promise<PaymentIntent> {
        return { method, status: "captured", reason: "ok" } as unknown as PaymentIntent;
      },
    };
    const paid = await reviewCheckout({ draft: draft(), config, provider: liar });
    expect(paid).toMatchObject({ ok: false, issues: ["payment"] });
  });

  it("accepts a listed pincode when the distance origin is unset and still rejects a map pin", async () => {
    const review = await reviewCheckout({
      draft: draft("600032"),
      config: { ...config, origin: { latitude: null, longitude: null } },
    });
    expect(review.ok).toBe(true);
    if (review.ok) {
      expect(review.order.serviceArea.pincode).toBe("600032");
      expect(review.order.serviceArea.areasEnglish).toBe("Guindy, Ekkatuthangal");
      expect(review.order.customer.address).toContain("Chennai 600032");
    }

    const pin = await reviewCheckout({
      draft: { ...draft("600001"), eligible: true },
      config: { ...config, origin: { latitude: 13.0280447, longitude: 80.1868165 } },
    });
    expect(pin.ok).toBe(false);
    if (!pin.ok) expect(pin.delivery.status).toBe("unavailable");
  });
});

describe("checkout route", () => {
  it("rejects a malformed body and does not accept a client payment claim", async () => {
    const malformed = await POST(new Request("http://localhost/api/checkout", { method: "POST", body: "nope" }));
    expect(malformed.status).toBe(400);

    const previousLatitude = process.env.DELIVERY_ORIGIN_LATITUDE;
    const previousLongitude = process.env.DELIVERY_ORIGIN_LONGITUDE;
    delete process.env.DELIVERY_ORIGIN_LATITUDE;
    delete process.env.DELIVERY_ORIGIN_LONGITUDE;
    const previousPass = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;
    try {
      const response = await POST(
        new Request("http://localhost/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft()),
        }),
      );
      const body = (await response.json()) as {
        ok: boolean;
        order?: { status?: string; payment?: { status?: string } };
        invoiceMail?: { shop: boolean; customer: boolean };
      };
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.order?.status).toBe("request_only");
      expect(body.order?.payment?.status).toBe("not_confirmed");
      expect(body.invoiceMail).toEqual({ shop: false, customer: false });

      const blocked = await POST(
        new Request("http://localhost/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft("623707")),
        }),
      );
      const blockedBody = (await blocked.json()) as { ok: boolean; issues?: string[] };
      expect(blockedBody.ok).toBe(false);
      expect(blockedBody.issues).toContain("delivery");
    } finally {
      if (previousLatitude === undefined) delete process.env.DELIVERY_ORIGIN_LATITUDE;
      else process.env.DELIVERY_ORIGIN_LATITUDE = previousLatitude;
      if (previousLongitude === undefined) delete process.env.DELIVERY_ORIGIN_LONGITUDE;
      else process.env.DELIVERY_ORIGIN_LONGITUDE = previousLongitude;
      if (previousPass === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = previousPass;
    }
  });

  it("keeps a client razorpay payload unpaid unless the server signature matches", async () => {
    const previousLatitude = process.env.DELIVERY_ORIGIN_LATITUDE;
    const previousLongitude = process.env.DELIVERY_ORIGIN_LONGITUDE;
    const previousKey = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.DELIVERY_ORIGIN_LATITUDE;
    delete process.env.DELIVERY_ORIGIN_LONGITUDE;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    const previousPass = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;
    const forged = {
      ...draft("600116"),
      razorpay: { orderId: "order_forged", paymentId: "pay_forged", signature: "forged" },
    };
    try {
      const unpaid = await POST(
        new Request("http://localhost/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forged),
        }),
      );
      const unpaidBody = (await unpaid.json()) as { ok: boolean; order?: { status?: string; payment?: { status?: string }; serviceArea?: { pincode?: string } } };
      expect(unpaidBody.ok).toBe(true);
      expect(unpaidBody.order?.status).toBe("request_only");
      expect(unpaidBody.order?.payment?.status).toBe("not_confirmed");
      expect(unpaidBody.order?.serviceArea?.pincode).toBe("600116");

      process.env.RAZORPAY_KEY_ID = "rzp_test_example";
      process.env.RAZORPAY_KEY_SECRET = "test-secret";
      const rejected = await POST(
        new Request("http://localhost/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(forged),
        }),
      );
      const rejectedBody = (await rejected.json()) as { ok: boolean; issues?: string[] };
      expect(rejectedBody.ok).toBe(false);
      expect(rejectedBody.issues).toContain("payment");
    } finally {
      if (previousLatitude === undefined) delete process.env.DELIVERY_ORIGIN_LATITUDE;
      else process.env.DELIVERY_ORIGIN_LATITUDE = previousLatitude;
      if (previousLongitude === undefined) delete process.env.DELIVERY_ORIGIN_LONGITUDE;
      else process.env.DELIVERY_ORIGIN_LONGITUDE = previousLongitude;
      if (previousKey === undefined) delete process.env.RAZORPAY_KEY_ID;
      else process.env.RAZORPAY_KEY_ID = previousKey;
      if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
      else process.env.RAZORPAY_KEY_SECRET = previousSecret;
      if (previousPass === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = previousPass;
    }
  });
});
