import { getProduct, site } from "@/lib/catalog";
import type { OrderLine, OrderRequest } from "@/lib/orders";

export type GstRate = 0 | 5;

export type TaxLine = {
  productId: string;
  variantId: string;
  nameEnglish: string;
  nameTamil: string;
  packEnglish: string | null;
  packTamil: string | null;
  quantity: number;
  hsn: string;
  ratePercent: GstRate;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
};

export type TaxInvoice = {
  number: string;
  date: string;
  placeOfSupply: string;
  reverseCharge: "No";
  lines: TaxLine[];
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  goodsPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
};

/** Shelf prices are GST-inclusive. Intra-state supply splits the tax into equal CGST and SGST. */
export function splitInclusiveGst(totalPaise: number, ratePercent: GstRate): { taxablePaise: number; cgstPaise: number; sgstPaise: number } {
  const paise = Math.max(0, Math.round(totalPaise));
  if (ratePercent === 0) return { taxablePaise: paise, cgstPaise: 0, sgstPaise: 0 };
  const taxablePaise = Math.round((paise * 100) / (100 + ratePercent));
  const tax = paise - taxablePaise;
  const cgstPaise = Math.floor(tax / 2);
  return { taxablePaise, cgstPaise, sgstPaise: tax - cgstPaise };
}

export function packKilograms(pack: string | null): number | null {
  if (!pack) return null;
  const match = /(\d+(?:\.\d+)?)\s*kg/i.exec(pack);
  if (!match) return null;
  const kilograms = Number(match[1]);
  return Number.isFinite(kilograms) ? kilograms : null;
}

/**
 * Pre-packaged labelled rice, millets, and cereal flours of 25 kg or less are 5%.
 * Packs above 25 kg of those goods are nil rated. Sevai stays at 5% at every pack size.
 */
export function gstForLine(productId: string, packEnglish: string | null): { hsn: string; ratePercent: GstRate } {
  const category = getProduct(productId)?.category;
  const kilograms = packKilograms(packEnglish);
  const bulk = kilograms != null && kilograms > 25;
  if (category === "sevai") return { hsn: "1902", ratePercent: 5 };
  const ratePercent: GstRate = bulk ? 0 : 5;
  if (category === "millets") return { hsn: "1008", ratePercent };
  if (category === "flour") return { hsn: flourHsn(productId), ratePercent };
  return { hsn: "1006", ratePercent };
}

function flourHsn(productId: string): string {
  if (productId === "ragi-flour") return "1106";
  if (productId === "idli-rava") return "1103";
  return "1102";
}

function kolkataParts(iso: string): { year: number; month: number; day: number } {
  const parsed = new Date(iso);
  const when = Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

export function financialYear(iso: string): string {
  const { year, month } = kolkataParts(iso);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function invoiceDate(iso: string): string {
  const { year, month, day } = kolkataParts(iso);
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

export function invoiceNumber(order: Pick<OrderRequest, "id" | "createdAt">): string {
  const serial = order.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "ORDER";
  return `AR/${financialYear(order.createdAt)}/${serial}`;
}

function rupeesToPaise(amount: number | null): number {
  if (amount == null || !Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function taxLine(line: OrderLine): TaxLine {
  const tax = gstForLine(line.productId, line.packEnglish);
  const totalPaise = rupeesToPaise(line.lineTotal);
  const split = splitInclusiveGst(totalPaise, tax.ratePercent);
  return {
    productId: line.productId,
    variantId: line.variantId,
    nameEnglish: line.nameEnglish,
    nameTamil: line.nameTamil,
    packEnglish: line.packEnglish,
    packTamil: line.packTamil,
    quantity: line.quantity,
    hsn: tax.hsn,
    ratePercent: tax.ratePercent,
    taxablePaise: split.taxablePaise,
    cgstPaise: split.cgstPaise,
    sgstPaise: split.sgstPaise,
    totalPaise,
  };
}

export function buildTaxInvoice(order: OrderRequest): TaxInvoice {
  const lines = order.lines.map(taxLine);
  const taxablePaise = lines.reduce((sum, line) => sum + line.taxablePaise, 0);
  const cgstPaise = lines.reduce((sum, line) => sum + line.cgstPaise, 0);
  const sgstPaise = lines.reduce((sum, line) => sum + line.sgstPaise, 0);
  const goodsPaise = lines.reduce((sum, line) => sum + line.totalPaise, 0);
  const deliveryFeePaise = rupeesToPaise(order.deliveryFee);
  return {
    number: invoiceNumber(order),
    date: invoiceDate(order.createdAt),
    placeOfSupply: `${site.gst.state} (${site.gst.stateCode})`,
    reverseCharge: "No",
    lines,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    goodsPaise,
    deliveryFeePaise,
    totalPaise: goodsPaise + deliveryFeePaise,
  };
}
