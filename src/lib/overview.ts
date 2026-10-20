import { db } from "./db";
import { heldDeposit, invoiceBalance } from "./domain";
export async function overview(businessId: string) {
  const now = new Date();
  const [vehicles, active, upcoming, invoices, transactions, allocations] = await Promise.all([
    db.vehicle.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } }),
    db.rental.findMany({ where: { businessId, state: "ACTIVE" }, include: { vehicle: true, customer: true }, orderBy: { endAt: "asc" } }),
    db.rental.findMany({ where: { businessId, state: "CONFIRMED" }, include: { vehicle: true, customer: true }, orderBy: { startAt: "asc" }, take: 5 }),
    db.invoice.findMany({ where: { businessId } }), db.moneyTransaction.findMany({ where: { businessId } }),
    db.allocation.findMany({ where: { businessId, active: true, startAt: { lte: now }, endAt: { gt: now } } }),
  ]);
  const rented = new Set(active.map(r => r.vehicleId)); const service = new Set(allocations.filter(a => a.kind === "MAINTENANCE").map(a => a.vehicleId));
  const reserved = new Set(allocations.filter(a => a.kind === "RENTAL").map(a => a.vehicleId));
  const fleet = vehicles.map(v => ({ ...v, displayState: rented.has(v.id) ? "ACTIVE" : service.has(v.id) ? "MAINTENANCE" : v.state === "ACTIVE" ? reserved.has(v.id) ? "RESERVED" : "AVAILABLE" : v.state }));
  return {
    fleet, active, upcoming, invoices, transactions,
    available: fleet.filter(v => v.displayState === "AVAILABLE").length,
    overdue: active.filter(r => r.endAt < now).length,
    receivable: invoices.filter(i => i.kind === "INVOICE").reduce((n, i) => n + Math.max(0, invoiceBalance(i, invoices, transactions)), 0),
    held: heldDeposit(transactions),
  };
}
