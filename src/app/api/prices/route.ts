import { readPriceBook } from "@/lib/price-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const book = await readPriceBook();
  return Response.json(book, { headers: { "Cache-Control": "no-store" } });
}
