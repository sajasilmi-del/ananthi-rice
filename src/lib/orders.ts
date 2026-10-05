import type { ConfirmedLocation } from "@/lib/types";
import type { PaymentIntent } from "@/lib/payment/types";

export const ORDER_STORAGE_KEY = "ananthi.orderRequests";

export type OrderLine = {
  productId: string;
  variantId: string;
  quantity: number;
  nameEnglish: string;
  nameTamil: string;
  packEnglish: string | null;
  packTamil: string | null;
  lineTotal: number | null;
};

export type OrderRequest = {
  id: string;
  createdAt: string;
  customer: {
    name: string;
    mobile: string;
    email: string;
    address: string;
  };
  location: ConfirmedLocation;
  distanceKm: number;
  lines: OrderLine[];
  subtotal: number | null;
  deliveryFee: number | null;
  total: number | null;
  payment: PaymentIntent;
  status: "request_only";
};

export function readOrders(storage: Pick<Storage, "getItem">): OrderRequest[] {
  const raw = storage.getItem(ORDER_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrderRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrderRequest(storage: Storage, order: OrderRequest): void {
  const orders = readOrders(storage);
  storage.setItem(ORDER_STORAGE_KEY, JSON.stringify([...orders, order]));
}
