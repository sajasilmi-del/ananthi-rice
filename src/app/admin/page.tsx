import type { Metadata } from "next";
import { AdminPrices } from "@/components/AdminPrices";
import { isAdminRequest } from "@/lib/admin-session";
import { priceStorageMode } from "@/lib/price-store-mode";
import { liveAdminRows } from "@/lib/price-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prices and stock",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const authed = await isAdminRequest();
  const rows = authed ? await liveAdminRows() : [];
  return <AdminPrices authed={authed} rows={rows} storage={priceStorageMode()} saved={params.saved === "1"} />;
}
