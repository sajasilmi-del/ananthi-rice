export type PriceStorageMode = "blob" | "file" | "unavailable";

export function priceStorageMode(env: NodeJS.ProcessEnv = process.env): PriceStorageMode {
  if (env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (env.VERCEL) return "unavailable";
  return "file";
}
