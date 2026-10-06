import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentIntent, PaymentMethod } from "@/lib/payment/types";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  mode: "test" | "live";
};

export type RazorpayProof = {
  orderId: string;
  paymentId: string;
  signature: string;
};

const KEY_ID_NAMES = ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_KEY"] as const;
const KEY_SECRET_NAMES = ["RAZORPAY_KEY_SECRET", "RAZORPAY_SECRET", "NEXT_PUBLIC_RAZORPAY_KEY_SECRET"] as const;

function unwrapEnv(value: string): string {
  let text = value.replace(/^\uFEFF/, "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function envValue(env: NodeJS.ProcessEnv, names: readonly string[]): string {
  for (const name of names) {
    const raw = env[name];
    if (typeof raw !== "string") continue;
    const value = unwrapEnv(raw);
    if (value) return value;
  }
  return "";
}

function parseKeyCsv(text: string): { keyId: string; keySecret: string } | null {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.includes("rzp_test_") || entry.includes("rzp_live_"));
  if (!line || !line.includes(",")) return null;
  const [keyId, keySecret] = line.split(",").map((part) => unwrapEnv(part));
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function readRazorpayConfig(env: NodeJS.ProcessEnv = process.env): RazorpayConfig | null {
  let keyId = envValue(env, KEY_ID_NAMES);
  let keySecret = envValue(env, KEY_SECRET_NAMES);
  if ((!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) || !keySecret) {
    const pasted = parseKeyCsv(`${keyId}\n${keySecret}`);
    if (pasted) {
      keyId = pasted.keyId;
      keySecret = pasted.keySecret;
    }
  }
  if (!keyId || !keySecret) return null;
  if (keyId.startsWith("rzp_test_")) return { keyId, keySecret, mode: "test" };
  if (keyId.startsWith("rzp_live_")) return { keyId, keySecret, mode: "live" };
  return null;
}

export function signRazorpayPayment(secret: string, orderId: string, paymentId: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function signaturesMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function basicAuth(config: RazorpayConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

type RazorpayPayment = {
  id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  order_id?: string;
};

async function razorpayFetch(
  config: RazorpayConfig,
  path: string,
  init: { method?: string; body?: unknown },
  fetchImpl: typeof fetch,
): Promise<RazorpayPayment | null> {
  const response = await fetchImpl(`${RAZORPAY_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: basicAuth(config),
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as RazorpayPayment;
  return payload && typeof payload === "object" ? payload : null;
}

export async function createRazorpayOrder(options: {
  config: RazorpayConfig;
  amountPaise: number;
  receipt: string;
  fetchImpl?: typeof fetch;
}): Promise<{ orderId: string; amount: number; currency: "INR" } | null> {
  if (!Number.isInteger(options.amountPaise) || options.amountPaise < 100) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const order = await razorpayFetch(
    options.config,
    "/orders",
    {
      method: "POST",
      body: {
        amount: options.amountPaise,
        currency: "INR",
        receipt: options.receipt.slice(0, 40),
        notes: { source: "ananthi-rice" },
      },
    },
    fetchImpl,
  );
  if (!order || typeof order.id !== "string" || !order.id.startsWith("order_")) return null;
  if (order.amount !== options.amountPaise || order.currency !== "INR") return null;
  return { orderId: order.id, amount: order.amount, currency: "INR" };
}

function paymentMatches(payment: RazorpayPayment, proof: RazorpayProof, amountPaise: number): boolean {
  return (
    payment.id === proof.paymentId &&
    payment.order_id === proof.orderId &&
    payment.amount === amountPaise &&
    payment.currency === "INR" &&
    (payment.status === "captured" || payment.status === "authorized")
  );
}

export async function verifyRazorpayPayment(options: {
  config: RazorpayConfig;
  proof: RazorpayProof;
  amountPaise: number;
  method: Exclude<PaymentMethod, "cod">;
  fetchImpl?: typeof fetch;
}): Promise<PaymentIntent | null> {
  const { config, proof, amountPaise, method } = options;
  if (!proof.orderId.startsWith("order_") || !proof.paymentId.startsWith("pay_")) return null;
  if (!Number.isInteger(amountPaise) || amountPaise < 100) return null;
  const expected = signRazorpayPayment(config.keySecret, proof.orderId, proof.paymentId);
  if (!signaturesMatch(expected, proof.signature)) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  let payment = await razorpayFetch(config, `/payments/${encodeURIComponent(proof.paymentId)}`, {}, fetchImpl);
  if (!payment || !paymentMatches(payment, proof, amountPaise)) return null;
  if (payment.status === "authorized") {
    payment = await razorpayFetch(
      config,
      `/payments/${encodeURIComponent(proof.paymentId)}/capture`,
      { method: "POST", body: { amount: amountPaise, currency: "INR" } },
      fetchImpl,
    );
    if (!payment || payment.status !== "captured" || !paymentMatches(payment, proof, amountPaise)) return null;
  }

  return {
    method,
    status: "captured",
    reason: config.mode === "test" ? "razorpay_test" : "razorpay_live",
    razorpayOrderId: proof.orderId,
    razorpayPaymentId: proof.paymentId,
  };
}
