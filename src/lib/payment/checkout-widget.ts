export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: () => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: {
  keyId: string;
  orderId: string;
  amount: number;
  name: string;
  email: string;
  contact: string;
}): Promise<RazorpaySuccess | "cancelled" | "failed"> {
  const loaded = await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!loaded || !Razorpay) return "failed";
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: RazorpaySuccess | "cancelled" | "failed") => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const checkout = new Razorpay({
      key: options.keyId,
      amount: options.amount,
      currency: "INR",
      name: "ANANTHI RICE",
      description: "Order",
      order_id: options.orderId,
      prefill: {
        name: options.name,
        email: options.email,
        contact: options.contact,
      },
      theme: { color: "#600030" },
      handler(response: RazorpaySuccess) {
        finish(response);
      },
      modal: {
        ondismiss() {
          finish("cancelled");
        },
      },
    });
    checkout.on("payment.failed", () => finish("failed"));
    checkout.open();
  });
}
