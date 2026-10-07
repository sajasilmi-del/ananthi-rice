import { site } from "@/lib/catalog";
import { buildTaxInvoice, type TaxInvoice, type TaxLine } from "@/lib/invoice";
import type { OrderRequest } from "@/lib/orders";
import { formatInr } from "@/lib/shop";

export type InvoiceMail = { shop: boolean; customer: boolean };

export type InvoiceMessage = { subject: string; text: string; html: string };

function inr(paise: number): string {
  return formatInr(paise / 100, "en");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentText(order: OrderRequest): string {
  const payment = order.payment;
  if (payment.status === "captured") {
    return `Paid online (${payment.method}). Payment reference: ${payment.razorpayPaymentId}.`;
  }
  if (payment.method === "cod") return "Cash on delivery. Not paid online.";
  return "Not paid online.";
}

function lineText(line: TaxLine): string {
  const pack = line.packEnglish ? ` (${line.packEnglish})` : "";
  const rate = line.ratePercent === 0 ? "Nil rated" : `${line.ratePercent}%`;
  return `${line.quantity} x ${line.nameEnglish}${pack} | HSN ${line.hsn} | GST ${rate} | Taxable ${inr(line.taxablePaise)} | CGST ${inr(line.cgstPaise)} | SGST ${inr(line.sgstPaise)} | Total ${inr(line.totalPaise)}`;
}

function invoiceText(order: OrderRequest, invoice: TaxInvoice): string[] {
  const state = `${site.gst.state} (${site.gst.stateCode})`;
  return [
    `Tax invoice ${invoice.number}`,
    `Date: ${invoice.date}`,
    `Seller: ${site.brandName}`,
    `Trade name: ${site.gst.tradeName}`,
    `Legal name: ${site.gst.legalName}`,
    `GSTIN: ${site.gst.gstin}`,
    `Principal place of business: ${site.gst.principalAddress}`,
    `Constitution: ${site.gst.constitution}`,
    `Registration: ${site.gst.registrationType}`,
    `State: ${state}`,
    `FSSAI: ${site.fssai.registrationNumber}`,
    `Place of supply: ${invoice.placeOfSupply}`,
    "Reverse charge: No",
    "",
    "Bill to / ship to:",
    order.customer.name,
    order.customer.address,
    `Phone: ${order.customer.mobile}`,
    `Email: ${order.customer.email}`,
    `Area: ${order.serviceArea.areasEnglish} (${order.serviceArea.pincode})`,
    "",
    "Lines:",
    ...(invoice.lines.length > 0 ? invoice.lines.map(lineText) : ["None"]),
    "",
    `Taxable value: ${inr(invoice.taxablePaise)}`,
    `CGST: ${inr(invoice.cgstPaise)}`,
    `SGST: ${inr(invoice.sgstPaise)}`,
    `Delivery fee: ${inr(invoice.deliveryFeePaise)}`,
    `Grand total: ${inr(invoice.totalPaise)}`,
    paymentText(order),
    "Prices include GST.",
  ];
}

function cell(value: string, header = false): string {
  const tag = header ? "th" : "td";
  return `<${tag} style="border:1px solid #d6cfc6;padding:6px 8px;text-align:left;vertical-align:top">${escapeHtml(value)}</${tag}>`;
}

function invoiceHtml(order: OrderRequest, invoice: TaxInvoice): string {
  const rows = invoice.lines
    .map((line) => {
      const pack = line.packEnglish ? ` (${line.packEnglish})` : "";
      const rate = line.ratePercent === 0 ? "Nil rated" : `${line.ratePercent}%`;
      return `<tr>${cell(`${line.quantity} x ${line.nameEnglish}${pack}`)}${cell(line.hsn)}${cell(rate)}${cell(inr(line.taxablePaise))}${cell(inr(line.cgstPaise))}${cell(inr(line.sgstPaise))}${cell(inr(line.totalPaise))}</tr>`;
    })
    .join("");
  const state = `${site.gst.state} (${site.gst.stateCode})`;
  return `<div style="font-family:Arial,sans-serif;color:#241c15;max-width:640px">
<p><strong>${escapeHtml(site.brandName)}</strong><br>${escapeHtml(site.gst.tradeName)}<br>Legal name: ${escapeHtml(site.gst.legalName)}<br>GSTIN: ${escapeHtml(site.gst.gstin)}<br>${escapeHtml(site.gst.principalAddress)}<br>${escapeHtml(site.gst.constitution)} · ${escapeHtml(site.gst.registrationType)} · ${escapeHtml(state)}<br>FSSAI: ${escapeHtml(site.fssai.registrationNumber)}</p>
<p>Tax invoice ${escapeHtml(invoice.number)}<br>Date: ${escapeHtml(invoice.date)}<br>Place of supply: ${escapeHtml(invoice.placeOfSupply)}<br>Reverse charge: No</p>
<p><strong>Bill to / ship to</strong><br>${escapeHtml(order.customer.name)}<br>${escapeHtml(order.customer.address)}<br>Phone: ${escapeHtml(order.customer.mobile)}<br>Email: ${escapeHtml(order.customer.email)}<br>${escapeHtml(order.serviceArea.areasEnglish)} (${escapeHtml(order.serviceArea.pincode)})</p>
<table style="border-collapse:collapse;width:100%"><thead><tr>${cell("Item", true)}${cell("HSN", true)}${cell("GST", true)}${cell("Taxable", true)}${cell("CGST", true)}${cell("SGST", true)}${cell("Total", true)}</tr></thead><tbody>${rows}</tbody></table>
<p>Taxable value: ${escapeHtml(inr(invoice.taxablePaise))}<br>CGST: ${escapeHtml(inr(invoice.cgstPaise))}<br>SGST: ${escapeHtml(inr(invoice.sgstPaise))}<br>Delivery fee: ${escapeHtml(inr(invoice.deliveryFeePaise))}<br><strong>Grand total: ${escapeHtml(inr(invoice.totalPaise))}</strong><br>${escapeHtml(paymentText(order))}<br>Prices include GST.</p>
</div>`;
}

export function invoiceMessages(order: OrderRequest): { shop: InvoiceMessage; customer: InvoiceMessage } {
  const invoice = buildTaxInvoice(order);
  const body = invoiceText(order, invoice);
  const html = invoiceHtml(order, invoice);
  const shopIntro = [
    "Shop copy. This email has the delivery address and the tax invoice.",
    "",
    "Delivery address:",
    order.customer.name,
    order.customer.address,
    `Phone: ${order.customer.mobile}`,
    `Email: ${order.customer.email}`,
    `Area: ${order.serviceArea.areasEnglish} (${order.serviceArea.pincode})`,
    "",
  ];
  return {
    shop: {
      subject: `Delivery address and tax invoice ${invoice.number} — ${order.customer.name}`,
      text: [...shopIntro, ...body].join("\n"),
      html: `<p><strong>Shop copy.</strong> Delivery address and tax invoice for ${escapeHtml(order.customer.name)}.</p>${html}`,
    },
    customer: {
      subject: `Your ANANTHI RICE tax invoice ${invoice.number}`,
      text: ["Your tax invoice from ANANTHI RICE.", "", ...body].join("\n"),
      html: `<p>Your tax invoice from ${escapeHtml(site.brandName)}.</p>${html}`,
    },
  };
}

function smtpAuth(): { user: string; pass: string } | null {
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

export async function sendInvoiceCopies(order: OrderRequest): Promise<InvoiceMail> {
  const auth = smtpAuth();
  if (!auth) return { shop: false, customer: false };
  const messages = invoiceMessages(order);
  const user = auth.user;
  const portValue = Number(process.env.SMTP_PORT || 465);
  const port = Number.isFinite(portValue) ? portValue : 465;
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth,
    });
    const from = `ANANTHI RICE <${user}>`;
    let shop = false;
    let customer = false;
    try {
      await transport.sendMail({
        from,
        to: site.email,
        replyTo: order.customer.email || undefined,
        subject: messages.shop.subject,
        text: messages.shop.text,
        html: messages.shop.html,
      });
      shop = true;
    } catch {
      shop = false;
    }
    if (order.customer.email) {
      try {
        await transport.sendMail({
          from,
          to: order.customer.email,
          replyTo: site.email,
          subject: messages.customer.subject,
          text: messages.customer.text,
          html: messages.customer.html,
        });
        customer = true;
      } catch {
        customer = false;
      }
    }
    return { shop, customer };
  } catch {
    return { shop: false, customer: false };
  }
}
