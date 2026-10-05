export const PAYMENT_METHODS = ["upi", "card", "netbanking", "cod"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentIntent = {
  method: PaymentMethod;
  status: "not_confirmed";
  reason: "provider_not_configured";
};

export interface PaymentProvider {
  readonly configured: false;
  listMethods(): readonly PaymentMethod[];
  createIntent(method: PaymentMethod): Promise<PaymentIntent>;
}
