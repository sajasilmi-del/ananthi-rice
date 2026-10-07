import { describe, expect, it } from "vitest";
import {
  createRazorpayOrder,
  readRazorpayConfig,
  readRazorpayStatus,
  signRazorpayPayment,
  verifyRazorpayPayment,
} from "@/lib/payment/razorpay";

const config = { keyId: "rzp_test_example", keySecret: "test-secret", mode: "test" as const };
const orderId = "order_abc";
const paymentId = "pay_abc";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("razorpay test keys", () => {
  it("reads a test or live key pair and ignores anything else", () => {
    expect(readRazorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_example", RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)?.mode).toBe("test");
    expect(readRazorpayConfig({ RAZORPAY_KEY_ID: "rzp_live_example", RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)?.mode).toBe("live");
    expect(readRazorpayConfig({ RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)).toBeNull();
    expect(readRazorpayConfig({ RAZORPAY_KEY_ID: "key_example", RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)).toBeNull();
    expect(readRazorpayConfig({ RAZORPAY_KEY_ID: '"rzp_test_example"', RAZORPAY_KEY_SECRET: "'secret'" } as NodeJS.ProcessEnv)).toMatchObject({
      keyId: "rzp_test_example",
      keySecret: "secret",
      mode: "test",
    });
    expect(
      readRazorpayConfig({ RAZORPAY_KEY_ID: "key_id,key_secret\nrzp_test_example,secret" } as NodeJS.ProcessEnv),
    ).toMatchObject({ keyId: "rzp_test_example", keySecret: "secret", mode: "test" });
    expect(readRazorpayConfig({ razorpay_key_id: "rzp_test_example", razorpay_key_secret: "secret" } as NodeJS.ProcessEnv)?.mode).toBe(
      "test",
    );
    expect(readRazorpayConfig({ KEY_ID: "rzp_test_example", KEY_SECRET: "secret" } as NodeJS.ProcessEnv)?.mode).toBe("test");
    expect(readRazorpayConfig({ rzp_test_example: "secret" } as NodeJS.ProcessEnv)).toMatchObject({
      keyId: "rzp_test_example",
      keySecret: "secret",
      mode: "test",
    });
    expect(readRazorpayConfig({ rzp_test_example: "rzp_test_example" } as NodeJS.ProcessEnv)).toBeNull();
    expect(readRazorpayStatus({} as NodeJS.ProcessEnv)).toEqual({ enabled: false, mode: null, reason: "missing", names: [] });
    expect(readRazorpayStatus({ RAZORPAY_KEY_ID: "rzp_test_example" } as NodeJS.ProcessEnv)).toMatchObject({
      enabled: false,
      reason: "missing_secret",
      names: ["RAZORPAY_KEY_ID"],
    });
    expect(readRazorpayStatus({ RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)).toMatchObject({
      enabled: false,
      reason: "missing_id",
    });
    expect(readRazorpayStatus({ RAZORPAY_KEY_ID: "key_example", RAZORPAY_KEY_SECRET: "secret" } as NodeJS.ProcessEnv)).toMatchObject({
      enabled: false,
      reason: "bad_prefix",
    });
  });

  it("creates an order only when Razorpay echoes the same paise amount", async () => {
    const created = await createRazorpayOrder({
      config,
      amountPaise: 16000,
      receipt: "receipt-1",
      fetchImpl: async () => jsonResponse({ id: orderId, amount: 16000, currency: "INR", status: "created" }),
    });
    expect(created).toEqual({ orderId, amount: 16000, currency: "INR" });

    const mismatched = await createRazorpayOrder({
      config,
      amountPaise: 16000,
      receipt: "receipt-1",
      fetchImpl: async () => jsonResponse({ id: orderId, amount: 100, currency: "INR" }),
    });
    expect(mismatched).toBeNull();
    expect(await createRazorpayOrder({ config, amountPaise: 50, receipt: "receipt-1" })).toBeNull();
  });

  it("attaches the shop order to the Razorpay order notes", async () => {
    let sent: { notes?: Record<string, string> } | null = null;
    const created = await createRazorpayOrder({
      config,
      amountPaise: 16000,
      receipt: "receipt-1",
      notes: { name: "Anand", phone: "9876543210", items1: "2x Ponni Boiled Rice 1 kg", "bad key": "skip" },
      fetchImpl: async (_input, init) => {
        sent = JSON.parse(String(init?.body)) as { notes?: Record<string, string> };
        return jsonResponse({ id: orderId, amount: 16000, currency: "INR" });
      },
    });
    expect(created?.orderId).toBe(orderId);
    expect(sent?.notes).toEqual({ name: "Anand", phone: "9876543210", items1: "2x Ponni Boiled Rice 1 kg" });
  });

  it("rejects a forged signature before calling Razorpay", async () => {
    const intent = await verifyRazorpayPayment({
      config,
      proof: { orderId, paymentId, signature: "forged" },
      amountPaise: 16000,
      method: "upi",
      fetchImpl: async () => {
        throw new Error("forged signature reached Razorpay");
      },
    });
    expect(intent).toBeNull();
  });

  it("captures an authorized test payment only when the amount matches", async () => {
    const signature = signRazorpayPayment(config.keySecret, orderId, paymentId);
    const calls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/capture")) {
        return jsonResponse({ id: paymentId, amount: 16000, currency: "INR", status: "captured", order_id: orderId });
      }
      return jsonResponse({ id: paymentId, amount: 16000, currency: "INR", status: "authorized", order_id: orderId });
    };
    const intent = await verifyRazorpayPayment({
      config,
      proof: { orderId, paymentId, signature },
      amountPaise: 16000,
      method: "card",
      fetchImpl,
    });
    expect(intent).toMatchObject({
      status: "captured",
      reason: "razorpay_test",
      method: "card",
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });
    expect(calls.some((call) => call.includes("/capture"))).toBe(true);

    const wrongAmount = await verifyRazorpayPayment({
      config,
      proof: { orderId, paymentId, signature },
      amountPaise: 32000,
      method: "upi",
      fetchImpl: async () => jsonResponse({ id: paymentId, amount: 16000, currency: "INR", status: "captured", order_id: orderId }),
    });
    expect(wrongAmount).toBeNull();
  });
});
