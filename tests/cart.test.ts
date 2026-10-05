import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  addLine,
  cartTotal,
  clampQuantity,
  clearCart,
  deliveryFee,
  itemCount,
  lineAmount,
  readCart,
  removeLine,
  setQuantity,
  subtotal,
  writeCart,
} from "@/lib/cart";
import { deliveryConfig } from "@/lib/catalog";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

const ponni = "ponni-boiled-rice";
const basmati = "basmati-rice";
const flour = "ragi-flour";

describe("shopping cart", () => {
  it("rejects quantities that are not positive integers and caps a known stock", () => {
    expect(clampQuantity(1, null)).toBe(1);
    expect(clampQuantity(4, null)).toBe(4);
    expect(clampQuantity(0, null)).toBeNull();
    expect(clampQuantity(-2, null)).toBeNull();
    expect(clampQuantity(1.5, null)).toBeNull();
    expect(clampQuantity(Number.NaN, null)).toBeNull();
    expect(clampQuantity(Number.POSITIVE_INFINITY, null)).toBeNull();
    expect(clampQuantity(5, 2)).toBe(2);
    expect(clampQuantity(2, 2)).toBe(2);
    expect(clampQuantity(1, 0)).toBeNull();
  });

  it("adds one item, merges the same pack, and keeps different pack sizes apart", () => {
    let lines = addLine([], { productId: ponni, variantId: "1kg", quantity: 1 });
    expect(lines).toEqual([{ productId: ponni, variantId: "1kg", quantity: 1 }]);
    expect(itemCount(lines)).toBe(1);

    lines = addLine(lines, { productId: ponni, variantId: "1kg", quantity: 2 });
    expect(lines).toEqual([{ productId: ponni, variantId: "1kg", quantity: 3 }]);

    lines = addLine(lines, { productId: ponni, variantId: "5kg", quantity: 1 });
    lines = addLine(lines, { productId: basmati, variantId: "10kg", quantity: 1 });
    expect(lines.map((line) => `${line.productId}:${line.variantId}`)).toEqual([
      `${ponni}:1kg`,
      `${ponni}:5kg`,
      `${basmati}:10kg`,
    ]);
    expect(itemCount(lines)).toBe(5);
    expect(subtotal(lines)).toBeNull();
    expect(lineAmount(lines[0])).toBeNull();
  });

  it("ignores invalid adds and unknown variants", () => {
    const lines = addLine([], { productId: ponni, variantId: "1kg", quantity: 1 });
    expect(addLine(lines, { productId: ponni, variantId: "1kg", quantity: 0 })).toBe(lines);
    expect(addLine(lines, { productId: ponni, variantId: "1kg", quantity: 1.2 })).toBe(lines);
    expect(addLine(lines, { productId: ponni, variantId: "no-such-pack", quantity: 1 })).toBe(lines);
    expect(addLine(lines, { productId: "missing-product", variantId: "1kg", quantity: 1 })).toEqual(lines);
    expect(addLine([], { productId: flour, variantId: "unspecified", quantity: 1 })).toEqual([
      { productId: flour, variantId: "unspecified", quantity: 1 },
    ]);
  });

  it("changes quantity, removes one pack, and clears the cart", () => {
    let lines = addLine([], { productId: ponni, variantId: "1kg", quantity: 1 });
    lines = addLine(lines, { productId: ponni, variantId: "25kg", quantity: 2 });
    lines = setQuantity(lines, ponni, "1kg", 4);
    expect(lines[0].quantity).toBe(4);
    expect(setQuantity(lines, ponni, "1kg", 1.5)).toBe(lines);
    expect(setQuantity(lines, ponni, "1kg", Number.NaN)).toBe(lines);
    lines = setQuantity(lines, ponni, "1kg", 0);
    expect(lines).toEqual([{ productId: ponni, variantId: "25kg", quantity: 2 }]);
    lines = removeLine(lines, ponni, "25kg");
    expect(lines).toEqual([]);
    expect(clearCart()).toEqual([]);
  });

  it("persists only purchasable whole quantities", () => {
    const storage = new MemoryStorage();
    const lines = addLine(addLine([], { productId: ponni, variantId: "5kg", quantity: 2 }), {
      productId: flour,
      variantId: "unspecified",
      quantity: 1,
    });
    writeCart(storage, lines);
    expect(readCart(storage)).toEqual(lines);
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { productId: ponni, variantId: "1kg", quantity: 0 },
        { productId: ponni, variantId: "5kg", quantity: 2.2 },
        { productId: ponni, variantId: "10kg", quantity: -3 },
        { productId: "missing-product", variantId: "1kg", quantity: 4 },
        { productId: flour, variantId: "unspecified", quantity: 1 },
      ]),
    );
    expect(readCart(storage)).toEqual([
      { productId: ponni, variantId: "5kg", quantity: 2 },
      { productId: flour, variantId: "unspecified", quantity: 1 },
    ]);
    storage.setItem(CART_STORAGE_KEY, "{");
    expect(readCart(storage)).toEqual([]);
  });

  it("adds a delivery fee only when delivery is available", () => {
    expect(deliveryFee({ status: "origin_not_configured" }, deliveryConfig)).toBeNull();
    expect(deliveryFee({ status: "location_required" }, deliveryConfig)).toBeNull();
    expect(deliveryFee({ status: "unavailable", distanceKm: 9, messageEn: "Delivery not available for this location.", messageTa: "இந்த இடத்திற்கு டெலிவரி வசதி இல்லை." }, deliveryConfig)).toBeNull();
    expect(deliveryFee({ status: "available", distanceKm: 1 }, deliveryConfig)).toBe(0);
    expect(cartTotal(null, 0)).toBeNull();
    expect(cartTotal(120, null)).toBeNull();
    expect(cartTotal(120, 0)).toBe(120);
  });
});
