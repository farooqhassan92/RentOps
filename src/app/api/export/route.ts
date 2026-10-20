import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { csv, moneyInput } from "@/lib/domain";
export async function GET(req: Request) {
  const b = await requireBusiness(); const type = new URL(req.url).searchParams.get("type");
  let rows: (string | number)[][];
  if (["invoices", "credit-notes"].includes(type || "")) {
    const invoices = await db.invoice.findMany({ where: { businessId: b.id, kind: type === "credit-notes" ? "CREDIT_NOTE" : "INVOICE" }, include: { rental: { select: { customerId: true } } }, orderBy: { issuedAt: "asc" } });
    rows = [["id", "rental_id", "customer_id", "number", "original_invoice_id", "issued_at_utc", "due_at_utc", "currency", "subtotal", "tax", "total"], ...invoices.map(i => [i.id, i.rentalId, i.rental.customerId, i.number, i.originalInvoiceId || "", i.issuedAt.toISOString(), i.dueAt.toISOString(), b.currency, moneyInput(i.subtotal, b.currency), moneyInput(i.tax, b.currency), moneyInput(i.total, b.currency)])];
  } else if (["payments", "deposits"].includes(type || "")) {
    const transactions = await db.moneyTransaction.findMany({ where: { businessId: b.id, kind: { in: type === "payments" ? ["PAYMENT", "PAYMENT_REFUND"] : ["DEPOSIT_RECEIVED", "DEPOSIT_REFUND", "DEPOSIT_APPLIED", "DEPOSIT_RESTORED"] } }, orderBy: { createdAt: "asc" } });
    rows = [["id", "rental_id", "invoice_id", "kind", "created_at_utc", "currency", "amount", "method", "reference", "reason"], ...transactions.map(t => [t.id, t.rentalId, t.invoiceId || "", t.kind, t.createdAt.toISOString(), b.currency, moneyInput(t.amount, b.currency), t.method, t.reference, t.reason])];
  } else if (type === "vehicles") {
    const vehicles = await db.vehicle.findMany({ where: { businessId: b.id } });
    rows = [["id", "plate", "vin", "make", "model", "year", "category", "odometer", "daily_rate", "weekly_rate", "monthly_rate", "deposit", "currency"], ...vehicles.map(v => [v.id, v.plate, v.vin || "", v.make, v.model, v.year, v.category, v.odometer, moneyInput(v.dailyRate, b.currency), moneyInput(v.weeklyRate, b.currency), moneyInput(v.monthlyRate, b.currency), moneyInput(v.depositRequired, b.currency), b.currency])];
  } else return new Response("Unknown export type", { status: 400 });
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rentops-${type}.csv"`, "Cache-Control": "private, no-store" } });
}

