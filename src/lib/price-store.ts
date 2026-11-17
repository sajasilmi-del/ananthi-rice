import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { categories, products, publishCatalog } from "@/lib/catalog";
import {
  adminProductRows,
  applyPriceBook,
  emptyPriceBook,
  mergePriceBook,
  parsePriceBook,
  type AdminProductRow,
  type PriceBook,
} from "@/lib/price-book";
import { priceStorageMode } from "@/lib/price-store-mode";

const BLOB_PATH = "catalog/price-book.json";

export function priceBookFile(root = process.cwd()): string {
  return path.join(root, "data", "price-book.json");
}

export function readPriceBookFile(file: string): PriceBook {
  try {
    return parsePriceBook(JSON.parse(readFileSync(file, "utf8"))) ?? emptyPriceBook;
  } catch {
    return emptyPriceBook;
  }
}

export function writePriceBookFile(file: string, book: PriceBook): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(book, null, 2)}\n`);
  renameSync(temporary, file);
}

async function readBlobBook(): Promise<PriceBook> {
  try {
    const result = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return emptyPriceBook;
    const text = await new Response(result.stream).text();
    return parsePriceBook(JSON.parse(text)) ?? emptyPriceBook;
  } catch {
    return emptyPriceBook;
  }
}

async function writeBlobBook(book: PriceBook): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(book), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function readPriceBook(): Promise<PriceBook> {
  try {
    if (priceStorageMode() === "blob") return await readBlobBook();
    if (priceStorageMode() === "file") return readPriceBookFile(priceBookFile());
  } catch {
    return emptyPriceBook;
  }
  return emptyPriceBook;
}

export async function writePriceBook(book: PriceBook): Promise<void> {
  const mode = priceStorageMode();
  if (mode === "blob") {
    await writeBlobBook(book);
    return;
  }
  if (mode === "file") {
    writePriceBookFile(priceBookFile(), book);
    return;
  }
  throw new Error("storage-not-configured");
}

export async function getLiveCatalog(): Promise<ProductList> {
  const book = await readPriceBook();
  const live = applyPriceBook(products, book);
  publishCatalog(live);
  return live;
}

type ProductList = ReturnType<typeof applyPriceBook>;

export async function publishLiveCatalog(): Promise<void> {
  await getLiveCatalog();
}

export async function savePriceUpdates(updates: Record<string, number | null>, now = new Date().toISOString()): Promise<PriceBook> {
  const current = await readPriceBook();
  const next = mergePriceBook(current, updates, now);
  await writePriceBook(next);
  publishCatalog(applyPriceBook(products, next));
  return next;
}

export async function liveAdminRows(): Promise<AdminProductRow[]> {
  return adminProductRows(await getLiveCatalog(), categories);
}
