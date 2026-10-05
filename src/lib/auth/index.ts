import { createDevAuthAdapter } from "@/lib/auth/dev-adapter";
import { createUnconfiguredAuthAdapter } from "@/lib/auth/production";
import type { AuthAdapter } from "@/lib/auth/types";

export function readAuthProvider(): string {
  return process.env.AUTH_PROVIDER ?? "";
}

export function createAuthAdapter(storage: Storage, provider = readAuthProvider()): AuthAdapter {
  const name = provider.trim().toLowerCase();
  if (name === "" || name === "development") return createDevAuthAdapter(storage);
  return createUnconfiguredAuthAdapter();
}
