import { sameSiteRequest } from "@/lib/admin-auth";
import { clearAdminCookie } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameSiteRequest(request)) return Response.json({ ok: false }, { status: 403 });
  await clearAdminCookie();
  return Response.json({ ok: true });
}
