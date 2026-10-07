import { describe, expect, it } from "vitest";
import { prepareCheckout } from "@/lib/checkout-review";
import type { OrderRequest } from "@/lib/orders";
import { shopOrderMessage, shopOrderNotes, shopOrderWhatsAppUrl } from "@/lib/shop-notice";
import type { DeliveryConfig } from "@/lib/types";

const config: DeliveryConfig = {
  enabled: true,
  radiusKm: 5,
  origin: { latitude: 9.5, longitude: 78.6 },
  feeWhenAvailableInr: 0,
};

const order: OrderRequest = {
  id: "order-1",
  createdAt: "2026-10-07T00:00:00.000Z",
  customer: {
    name: "Anand",
    mobile: "9876543210",
    email: "anand@example.com",
    address: "12, Hillcrest, 2nd Main Road, Ramapuram, Chennai 600089, 9876543210",
  },
  serviceArea: {
    source: "pincode",
    pincode: "600089",
    areasEnglish: "Ramapuram, Nandambakkam",
    areasTamil: "இராமபுரம், நந்தம்பாக்கம்",
  },
  lines: [
    {
      productId: "ponni-boiled-rice",
      variantId: "1kg",
      quantity: 2,
      nameEnglish: "Ponni Boiled Rice",
      nameTamil: "பொன்னி புழுங்கல் அரிசி",
      packEnglish: "1 kg",
      packTamil: "1 கிலோ",
      lineTotal: 320,
    },
  ],
  subtotal: 320,
  deliveryFee: 0,
  total: 320,
  payment: {
    method: "upi",
    status: "captured",
    reason: "razorpay_live",
    razorpayOrderId: "order_abc",
    razorpayPaymentId: "pay_abc",
  },
  status: "paid",
};

describe("shop order notice", () => {
  it("sends the products, address, phone, and payment reference to the shop WhatsApp", () => {
    const text = shopOrderMessage(order);
    expect(text).toContain("ANANTHI RICE paid order");
    expect(text).toContain("Payment reference: pay_abc");
    expect(text).toContain("Razorpay order: order_abc");
    expect(text).toContain("Phone: 9876543210");
    expect(text).toContain("Email: anand@example.com");
    expect(text).toContain("Address: 12, Hillcrest, 2nd Main Road, Ramapuram, Chennai 600089, 9876543210");
    expect(text).toContain("2 × Ponni Boiled Rice (1 kg)");
    expect(text).toContain("Ramapuram, Nandambakkam (600089)");
    const url = shopOrderWhatsAppUrl(order);
    expect(url.startsWith("https://wa.me/919942034428?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(text);
  });

  it("puts the same order on the Razorpay payment notes", () => {
    const quote = prepareCheckout(
      {
        locale: "en",
        customer: {
          name: "Anand",
          mobile: "9876543210",
          door: "12",
          building: "Hillcrest",
          street: "2nd Main Road",
          locality: "Ramapuram",
          email: "anand@example.com",
          pincode: "600089",
        },
        lines: [{ productId: "ponni-boiled-rice", variantId: "1kg", quantity: 2 }],
        method: "upi",
      },
      config,
    );
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    const notes = shopOrderNotes({
      name: quote.customer.name,
      phone: quote.customer.mobile,
      email: quote.customer.email,
      address: quote.customer.address,
      area: quote.serviceArea.areasEnglish,
      pincode: quote.serviceArea.pincode,
      method: quote.method,
      total: quote.total,
      lines: quote.lines,
    });
    expect(notes.phone).toBe("9876543210");
    expect(notes.email).toBe("anand@example.com");
    expect(notes.address).toContain("Ramapuram");
    expect(notes.area).toContain("600089");
    expect(notes.items1).toContain("2x Ponni Boiled Rice");
    expect(notes.items1).toContain("1 kg");
    expect(notes.total).toContain("320");
    expect(Object.keys(notes).length).toBeLessThanOrEqual(15);
    for (const value of Object.values(notes)) expect(value.length).toBeLessThanOrEqual(255);
  });
});
