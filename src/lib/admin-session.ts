import { cookies } from "next/headers";
import { createSessionToken, readSessionToken } from "@/lib/admin-auth";

export const ADMIN_COOKIE = "ananthi_admin";
const SESSION_SECONDS = 12 * 60 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function isAdminRequest(): Promise<boolean> {
  const jar = await cookies();
  return readSessionToken(jar.get(ADMIN_COOKIE)?.value);
}

export async function setAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, createSessionToken(), cookieOptions(SESSION_SECONDS));
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", cookieOptions(0));
}
