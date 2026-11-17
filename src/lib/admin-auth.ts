import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MS = 12 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Attempt = { count: number; reset: number };

const failures = new Map<string, Attempt>();

export function adminPassword(env: NodeJS.ProcessEnv = process.env): string {
  return env.ADMIN_PASSWORD?.trim() ?? "";
}

export function passwordMatches(input: string, expected: string): boolean {
  const actual = createHash("sha256").update(input).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

function sign(payload: string, password: string): string {
  return createHmac("sha256", password).update(`ananthi-admin-v1.${payload}`).digest("base64url");
}

export function createSessionToken(now = Date.now(), password = adminPassword()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_MS }), "utf8").toString("base64url");
  return `${payload}.${sign(payload, password)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now(), password = adminPassword()): boolean {
  if (!token || !password) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload, password);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof body.exp === "number" && Number.isFinite(body.exp) && body.exp > now;
  } catch {
    return false;
  }
}

export function recordLoginFailure(key: string, now = Date.now()): "ok" | "limited" {
  const current = failures.get(key);
  if (!current || current.reset <= now) {
    failures.set(key, { count: 1, reset: now + WINDOW_MS });
    return "ok";
  }
  current.count += 1;
  if (current.count > MAX_FAILURES) return "limited";
  return "ok";
}

export function loginIsLimited(key: string, now = Date.now()): boolean {
  const current = failures.get(key);
  return Boolean(current && current.reset > now && current.count >= MAX_FAILURES);
}

export function clearLoginFailures(key?: string): void {
  if (key) failures.delete(key);
  else failures.clear();
}

export function sameSiteRequest(request: Request): boolean {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}
