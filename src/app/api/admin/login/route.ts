import {
  adminPassword,
  clientAddress,
  clearLoginFailures,
  passwordMatches,
  recordLoginFailure,
  sameSiteRequest,
} from "@/lib/admin-auth";
import { setAdminCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameSiteRequest(request)) return Response.json({ ok: false, error: "origin" }, { status: 403 });
  if (!adminPassword()) return Response.json({ ok: false, error: "unconfigured" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const input = body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
    ? (body as { password: string }).password
    : "";
  const key = clientAddress(request);
  if (passwordMatches(input, adminPassword())) {
    clearLoginFailures(key);
    await setAdminCookie();
    return Response.json({ ok: true });
  }
  const attempt = recordLoginFailure(key);
  return Response.json(
    { ok: false, error: attempt === "limited" ? "limited" : "password" },
    { status: attempt === "limited" ? 429 : 401 },
  );
}
