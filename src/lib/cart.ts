import { getProduct, getVariant, isPurchasable, unitPrice } from "@/lib/catalog";
import type { CartLine, DeliveryConfig, Variant } from "@/lib/types";

export const CART_STORAGE_KEY = "ananthi.cart";

/**
 * A stored quantity is a positive integer.
 * Unknown stock (null) is not a cap. Zero stock cannot be purchased.
 */
export function clampQuantity(quantity: number, stock: number | null): number | null {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) return null;
  if (stock == null) return quantity;
  if (!Number.isFinite(stock) || stock < 1) return null;
  return Math.min(quantity, Math.trunc(stock));
}

function purchasableVariant(productId: string, variantId: string): Variant | null {
  const product = getProduct(productId);
  const variant = product ? getVariant(product, variantId) : undefined;
  if (!product?.active || !variant || !isPurchasable(variant)) return null;
  return variant;
}

function quantityFromStorage(quantity: unknown, stock: number | null): number | null {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return null;
  return clampQuantity(Math.floor(quantity), stock);
}

export function readCart(storage: Pick<Storage, "getItem">): CartLine[] {
  const raw = storage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    let lines: CartLine[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const productId = (entry as CartLine).productId;
      const variantId = (entry as CartLine).variantId;
      if (typeof productId !== "string" || typeof variantId !== "string") continue;
      const variant = purchasableVariant(productId, variantId);
      if (!variant) continue;
      const quantity = quantityFromStorage((entry as CartLine).quantity, variant.stock);
      if (quantity == null) continue;
      lines = addLine(lines, { productId, variantId, quantity });
    }
    return lines;
  } catch {
    return [];
  }
}

export function writeCart(storage: Pick<Storage, "setItem">, lines: CartLine[]): void {
  storage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function addLine(lines: CartLine[], next: CartLine): CartLine[] {
  const variant = purchasableVariant(next.productId, next.variantId);
  if (!variant) return lines;
  const quantity = clampQuantity(next.quantity, variant.stock);
  if (quantity == null) return lines;
  const index = lines.findIndex(
    (line) => line.productId === next.productId && line.variantId === next.variantId,
  );
  if (index === -1) return [...lines, { productId: next.productId, variantId: next.variantId, quantity }];
  const merged = clampQuantity(lines[index].quantity + quantity, variant.stock);
  if (merged == null) return lines;
  return lines.map((line, lineIndex) => (lineIndex === index ? { ...line, quantity: merged } : line));
}

export function removeLine(lines: CartLine[], productId: string, variantId: string): CartLine[] {
  return lines.filter((line) => !(line.productId === productId && line.variantId === variantId));
}

export function setQuantity(
  lines: CartLine[],
  productId: string,
  variantId: string,
  quantity: number,
): CartLine[] {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) return lines;
  if (quantity < 1) return removeLine(lines, productId, variantId);
  const variant = purchasableVariant(productId, variantId);
  if (!variant) return removeLine(lines, productId, variantId);
  const next = clampQuantity(quantity, variant.stock);
  if (next == null) return removeLine(lines, productId, variantId);
  return lines.map((line) =>
    line.productId === productId && line.variantId === variantId ? { ...line, quantity: next } : line,
  );
}

export function clearCart(): CartLine[] {
  return [];
}

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function lineAmount(line: CartLine): number | null {
  const variant = purchasableVariant(line.productId, line.variantId);
  const price = variant ? unitPrice(variant) : null;
  if (price == null) return null;
  return price * line.quantity;
}

export function subtotal(lines: CartLine[]): number | null {
  let sum = 0;
  for (const line of lines) {
    const amount = lineAmount(line);
    if (amount == null) return null;
    sum += amount;
  }
  return sum;
}

export function deliveryFee(result: { status: string }, config: DeliveryConfig): number | null {
  if (result.status !== "available") return null;
  return config.feeWhenAvailableInr;
}

export function cartTotal(productSubtotal: number | null, fee: number | null): number | null {
  if (productSubtotal == null || fee == null) return null;
  return productSubtotal + fee;
}
