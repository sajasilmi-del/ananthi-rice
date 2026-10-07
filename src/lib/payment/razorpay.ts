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

const KEY_ID_NAMES = ["RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_KEY", "RZP_KEY_ID", "RZP_KEY", "KEY_ID"] as const;
const KEY_SECRET_NAMES = [
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_SECRET",
  "RZP_KEY_SECRET",
  "RZP_SECRET",
  "KEY_SECRET",
] as const;

function unwrapEnv(value: string): string {
  let text = value.replace(/^\uFEFF/, "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function envValue(env: NodeJS.ProcessEnv, names: readonly string[]): string {
  const entries = Object.entries(env);
  for (const wanted of names) {
    for (const [name, raw] of entries) {
      if (name.toLowerCase() !== wanted.toLowerCase() || typeof raw !== "string") continue;
      const value = unwrapEnv(raw);
      if (value) return value;
    }
  }
  return "";
}

export function razorpayEnvNames(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => /razor|rzp|^key_id$|^key_secret$/i.test(name))
    .filter((name) => {
      const raw = env[name];
      return typeof raw === "string" && unwrapEnv(raw).length > 0;
    })
    .map((name) => (name.startsWith("rzp_test_") || name.startsWith("rzp_live_") ? "key id used as the name" : name))
    .sort();
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

function keyStoredAsName(env: NodeJS.ProcessEnv): { keyId: string; keySecret: string } | null {
  for (const [name, raw] of Object.entries(env)) {
    if (typeof raw !== "string") continue;
    const keyId = unwrapEnv(name);
    const keySecret = unwrapEnv(raw);
    if (!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) continue;
    if (!keySecret || keySecret === keyId || keySecret.startsWith("rzp_test_") || keySecret.startsWith("rzp_live_")) continue;
    return { keyId, keySecret };
  }
  return null;
}

function readKeyPair(env: NodeJS.ProcessEnv): { keyId: string; keySecret: string } {
  let keyId = envValue(env, KEY_ID_NAMES);
  let keySecret = envValue(env, KEY_SECRET_NAMES);
  if ((!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) || !keySecret) {
    const pasted = parseKeyCsv(`${keyId}\n${keySecret}`);
    if (pasted) {
      keyId = pasted.keyId;
      keySecret = pasted.keySecret;
    }
  }
  if ((!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) || !keySecret) {
    const storedAsName = keyStoredAsName(env);
    if (storedAsName) return storedAsName;
  }
  return { keyId, keySecret };
}

export type RazorpayStatus =
  | { enabled: true; mode: "test" | "live" }
  | { enabled: false; mode: null; reason: "missing" | "missing_id" | "missing_secret" | "bad_prefix"; names: string[] };

export function readRazorpayStatus(env: NodeJS.ProcessEnv = process.env): RazorpayStatus {
  const { keyId, keySecret } = readKeyPair(env);
  if (keyId.startsWith("rzp_test_") && keySecret) return { enabled: true, mode: "test" };
  if (keyId.startsWith("rzp_live_") && keySecret) return { enabled: true, mode: "live" };
  const names = razorpayEnvNames(env);
  if (keyId && !keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
    return { enabled: false, mode: null, reason: "bad_prefix", names };
  }
  if (!keyId && !keySecret) return { enabled: false, mode: null, reason: "missing", names };
  if (!keyId) return { enabled: false, mode: null, reason: "missing_id", names };
  return { enabled: false, mode: null, reason: "missing_secret", names };
}

export function readRazorpayConfig(env: NodeJS.ProcessEnv = process.env): RazorpayConfig | null {
  const { keyId, keySecret } = readKeyPair(env);
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

function paymentNotes(notes: Record<string, string> | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(notes ?? {})) {
    if (Object.keys(clean).length >= 15) break;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key)) continue;
    const text = value.replace(/\s+/g, " ").trim().slice(0, 255);
    if (text) clean[key] = text;
  }
  return Object.keys(clean).length > 0 ? clean : { source: "ananthi-rice" };
}

export async function createRazorpayOrder(options: {
  config: RazorpayConfig;
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
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
        notes: paymentNotes(options.notes),
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
