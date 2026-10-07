import { describe, expect, it } from "vitest";
import { site } from "@/lib/catalog";
import { buildTaxInvoice, financialYear, gstForLine, invoiceDate, splitInclusiveGst } from "@/lib/invoice";
import { invoiceMessages, sendInvoiceCopies } from "@/lib/mail";
import type { OrderRequest } from "@/lib/orders";

function order(lines: OrderRequest["lines"], createdAt = "2026-10-07T05:36:00.000Z"): OrderRequest {
  const goods = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  return {
    id: "6ad0f80c-9d0d-416c-ac2b-a00ab4a14d40",
    createdAt,
    customer: {
      name: "Anand <script>",
      mobile: "9876543210",
      email: "anand@example.com",
      address: "12, Hillcrest, 2nd Main Road, Ramapuram, Chennai 600089, 9876543210",
    },
    serviceArea: {
      source: "pincode",
      pincode: "600089",
      areasEnglish: "Ramapuram, Nandambakkam",
      areasTamil: "இராமபுரம், நந்தம்பாக்கம்",
    },
    lines,
    subtotal: goods,
    deliveryFee: 0,
    total: goods,
    payment: { method: "cod", status: "not_confirmed", reason: "provider_not_configured" },
    status: "request_only",
  };
}

function line(productId: string, packEnglish: string, lineTotal: number, variantId = "1kg"): OrderRequest["lines"][number] {
  return {
    productId,
    variantId,
    quantity: 1,
    nameEnglish: productId,
    nameTamil: productId,
    packEnglish,
    packTamil: packEnglish,
    lineTotal,
  };
}

describe("GST tax invoice", () => {
  it("splits an inclusive 5 percent price into CGST and SGST", () => {
    expect(splitInclusiveGst(16000, 5)).toEqual({ taxablePaise: 15238, cgstPaise: 381, sgstPaise: 381 });
    expect(splitInclusiveGst(32000, 5)).toEqual({ taxablePaise: 30476, cgstPaise: 762, sgstPaise: 762 });
    expect(splitInclusiveGst(293900, 0)).toEqual({ taxablePaise: 293900, cgstPaise: 0, sgstPaise: 0 });
  });

  it("uses the certificate GSTIN and nil-rates cereal packs above 25 kg", () => {
    expect(gstForLine("ponni-boiled-rice", "1 kg")).toEqual({ hsn: "1006", ratePercent: 5 });
    expect(gstForLine("ponni-boiled-rice", "26 kg")).toEqual({ hsn: "1006", ratePercent: 0 });
    expect(gstForLine("seeraga-samba-rice", "10 kg")).toEqual({ hsn: "1006", ratePercent: 5 });
    expect(gstForLine("panivaragu", "26 kg")).toEqual({ hsn: "1008", ratePercent: 0 });
    expect(gstForLine("rice-flour", "5 kg")).toEqual({ hsn: "1102", ratePercent: 5 });
    expect(gstForLine("ragi-flour", "1 kg")).toEqual({ hsn: "1106", ratePercent: 5 });
    expect(gstForLine("idli-rava", "26 kg")).toEqual({ hsn: "1103", ratePercent: 0 });
    expect(gstForLine("rice-sevai", "26 kg")).toEqual({ hsn: "1902", ratePercent: 5 });

    const bill = buildTaxInvoice(
      order([
        line("ponni-boiled-rice", "1 kg", 160),
        line("ponni-boiled-rice", "26 kg", 2939, "26kg"),
        line("rice-sevai", "26 kg", 100, "26kg"),
      ]),
    );
    expect(bill.number).toBe("AR/2026-27/6AD0F80C");
    expect(bill.date).toBe("07-10-2026");
    expect(bill.placeOfSupply).toBe("Tamil Nadu (33)");
    expect(bill.reverseCharge).toBe("No");
    expect(bill.lines.map((item) => [item.hsn, item.ratePercent, item.cgstPaise])).toEqual([
      ["1006", 5, 381],
      ["1006", 0, 0],
      ["1902", 5, 238],
    ]);
    expect(bill.totalPaise).toBe(16000 + 293900 + 10000);
    expect(financialYear("2026-03-31T18:29:00.000Z")).toBe("2025-26");
    expect(invoiceDate("2026-03-31T18:30:00.000Z")).toBe("01-04-2026");
    expect(site.gst.gstin).toBe("33ALVPA6063F2Z4");
  });

  it("writes a shop copy with the delivery address and a customer invoice, without sending mail", async () => {
    const placed = order([line("ponni-boiled-rice", "1 kg", 160)]);
    const messages = invoiceMessages(placed);
    expect(messages.shop.subject).toContain("Delivery address and tax invoice AR/2026-27/6AD0F80C");
    expect(messages.shop.text).toContain("12, Hillcrest, 2nd Main Road, Ramapuram, Chennai 600089");
    expect(messages.shop.text).toContain("GSTIN: 33ALVPA6063F2Z4");
    expect(messages.shop.text).toContain("Legal name: Ananthavalli");
    expect(messages.shop.text).toContain("anand@example.com");
    expect(messages.shop.text).toContain("Cash on delivery. Not paid online.");
    expect(messages.customer.subject).toBe("Your ANANTHI RICE tax invoice AR/2026-27/6AD0F80C");
    expect(messages.customer.text).toContain("Taxable value:");
    expect(messages.customer.html).toContain("&lt;script&gt;");
    expect(messages.customer.html).not.toContain("<script>");

    const previous = process.env.SMTP_PASS;
    delete process.env.SMTP_PASS;
    try {
      await expect(sendInvoiceCopies(placed)).resolves.toEqual({ shop: false, customer: false });
    } finally {
      if (previous === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = previous;
    }
  });
});
