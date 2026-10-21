import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { documentPdf } from "@/lib/pdf";
import { money, quote, dateLabel } from "@/lib/domain";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ type: string; id: string }> }) {
  const b = await requireBusiness(); const { type, id } = await params;
  let title: string; let lines: string[];
  if (type === "contract") {
    const r = await db.rental.findFirst({ where: { id, businessId: b.id }, include: { customer: true, vehicle: true, inspections: { include: { vehicle: true }, orderBy: { createdAt: "asc" } } } });
    if (!r) return new Response("Not found", { status: 404 });
    const totals = quote(r, b.timezone);
    title = `Rental agreement ${r.id.slice(-8).toUpperCase()}`;
    lines = [b.name, `${b.branchName} | ${b.address}`, `${b.email} | ${b.phone}`, `Status: ${r.state}`, "", `Customer: ${r.customer.name}${r.customer.company ? ` | ${r.customer.company}` : ""}`, `Address: ${r.customer.address}`, `Contact: ${r.customer.phone} | ${r.customer.email}`, `Driving licence: ${r.customer.licenseNumber} | expires ${r.customer.licenseExpiry.toISOString().slice(0, 10)}`, "", `Current vehicle: ${r.vehicle.make} ${r.vehicle.model} | ${r.vehicle.plate}`, `Pickup: ${dateLabel(r.startAt, b.timezone)} (${b.timezone})`, `Expected return: ${dateLabel(r.endAt, b.timezone)} (${b.timezone})`, `Rate: ${money(r.unitRate, b.currency)} per ${r.rateUnit.toLowerCase()}`, `Included distance: ${r.includedKm} km | Additional km: ${money(r.extraKmRate, b.currency)}`, `Net extras: ${money(r.extras, b.currency)} | Net discount: ${money(r.discount, b.currency)}`, `Tax: ${r.taxBps / 100}% | Agreed estimate: ${money(totals.total, b.currency)}`, `Refundable deposit: ${money(r.depositRequired, b.currency)}`, "", "Daily/weekly periods round up. Partial calendar months are prorated. Early returns retain agreed charges unless credited. Late monthly returns are charged per started day at 1/30 monthly rate. Estimates exclude return charges. Actual invoices govern settlement.", "", "Rental terms", r.termsSnapshot || "No additional terms configured.", r.notes, "", ...r.inspections.map(i => `${i.kind}: ${i.vehicle.plate} | ${i.odometer} km | fuel/charge ${i.fuelPercent}% | ${dateLabel(i.createdAt, b.timezone)} | ${i.condition}`), "", "Customer signature: ____________________  Date: ______________", "Owner signature: _______________________  Date: ______________"];
  } else if (type === "invoice") {
    const i = await db.invoice.findFirst({ where: { id, businessId: b.id } });
    if (!i) return new Response("Not found", { status: 404 });
    const company = i.businessSnapshot as Record<string, string>; const customer = i.customerSnapshot as Record<string, string>;
    title = `${i.kind === "CREDIT_NOTE" ? "Credit note" : "Invoice"} ${i.number}`;
    lines = [company.name, `${company.branchName} | ${company.address}`, `Tax ID: ${company.taxId || "Not supplied"}`, `${company.email} | ${company.phone}`, "", `Bill to: ${customer.name}${customer.company ? ` | ${customer.company}` : ""}`, customer.address, `${customer.email} | ${customer.phone}`, "", `Issued: ${dateLabel(i.issuedAt, b.timezone)}`, `Due: ${dateLabel(i.dueAt, b.timezone)}`, ...(i.originalInvoiceId ? [`Original invoice ID: ${i.originalInvoiceId}`] : []), "", i.description, ...(i.periodStart && i.periodEnd ? [`Period: ${dateLabel(i.periodStart, b.timezone)} - ${dateLabel(i.periodEnd, b.timezone)}`] : []), "", `Subtotal: ${money(i.subtotal, company.currency)}`, `Tax: ${money(i.tax, company.currency)}`, `Total: ${money(i.total, company.currency)}`, "", "Refundable deposits are recorded separately from this invoice."];
  } else if (type === "receipt") {
    const t = await db.moneyTransaction.findFirst({ where: { id, businessId: b.id }, include: { rental: { include: { customer: true } }, invoice: true } });
    if (!t) return new Response("Not found", { status: 404 });
    title = `Transaction receipt ${t.id.slice(-8).toUpperCase()}`;
    lines = [b.name, `${b.branchName} | ${b.address}`, "", `Customer: ${t.rental.customer.name}`, `Transaction: ${t.kind.replaceAll("_", " ")}`, `Amount: ${money(t.amount, b.currency)}`, `Method: ${t.method}`, `Date: ${dateLabel(t.createdAt, b.timezone)} (${b.timezone})`, `Invoice: ${t.invoice?.number || "Not applicable - deposit"}`, `Reference: ${t.reference || "Not supplied"}`, `Reason: ${t.reason || "Not supplied"}`, `Rental ID: ${t.rentalId}`, "", "This receipt records an externally collected payment or an internal deposit movement. RentOps does not process card payments."];
  } else return new Response("Not found", { status: 404 });
  const pdf = await documentPdf(title, lines);
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rentops-${type}-${id.replace(/[^a-zA-Z0-9]/g, "")}.pdf"`, "Cache-Control": "private, no-store" } });
}
