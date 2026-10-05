import { PAYMENT_METHODS, type PaymentIntent, type PaymentMethod, type PaymentProvider } from "@/lib/payment/types";

export function createUnconfiguredPaymentProvider(): PaymentProvider {
  return {
    configured: false,
    listMethods() {
      return PAYMENT_METHODS;
    },
    async createIntent(method: PaymentMethod): Promise<PaymentIntent> {
      if (!PAYMENT_METHODS.includes(method)) {
        throw new Error("Unknown payment method");
      }
      return {
        method,
        status: "not_confirmed",
        reason: "provider_not_configured",
      };
    },
  };
}
