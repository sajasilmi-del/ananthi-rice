import { sameSiteRequest } from "@/lib/admin-auth";
import { isAdminRequest } from "@/lib/admin-session";
import { products } from "@/lib/catalog";
import { validatePriceDraft } from "@/lib/price-book";
import { savePriceUpdates } from "@/lib/price-store";
import { priceStorageMode } from "@/lib/price-store-mode";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!sameSiteRequest(request)) return Response.json({ ok: false, error: "origin" }, { status: 403 });
  if (!(await isAdminRequest())) return Response.json({ ok: false, error: "auth" }, { status: 401 });
  if (priceStorageMode() === "unavailable") return Response.json({ ok: false, error: "storage" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const draft = validatePriceDraft(body, products);
  if (!draft.ok) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  try {
    await savePriceUpdates(draft.updates);
  } catch (error) {
    console.error("Price save failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, error: "storage" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
