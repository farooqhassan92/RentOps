// Server entry points must obtain OwnerContext from requireBusiness(), never client input.
// Every mutation revalidates ownership under a per-business database lock.
import { db } from "./db";
import { Prisma, type Business } from "@/generated/prisma/client";
import { assert, buffered, DomainError, heldDeposit, invoiceBalance, monthlyPeriods, quote, rentalBalance, taxTotal, today, interval } from "./domain";
import { businessSchema, customerSchema, inspectionSchema, rentalSchema, vehicleSchema } from "./validation";
import { z } from "zod";

export type OwnerContext = { id: string; ownerClerkId: string };
type Tx = Prisma.TransactionClient;
type Rental = Prisma.RentalGetPayload<{ include: { vehicle: true; customer: true; invoices: true; transactions: true; inspections: true } }>;
const rentalInclude = { vehicle: true, customer: true, invoices: true, transactions: true, inspections: true } as const;
export async function owned<T>(ctx: OwnerContext, fn: (tx: Tx, business: Business) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Business" WHERE id = ${ctx.id} AND "ownerClerkId" = ${ctx.ownerClerkId} FOR UPDATE`;
    assert(rows.length === 1, "Business not found.");
    const business = await tx.business.findUniqueOrThrow({ where: { id: ctx.id } });
    return fn(tx, business);
  }, { timeout: 20000, maxWait: 10000 });
}
async function audit(tx: Tx, b: Business, action: string, entityType: string, entityId: string, details: Prisma.InputJsonValue = {}) {
  await tx.audit.create({ data: { businessId: b.id, actorClerkId: b.ownerClerkId, action, entityType, entityId, details } });
}
async function rentalFor(tx: Tx, b: Business, id: string): Promise<Rental> {
  const rental = await tx.rental.findFirst({ where: { businessId: b.id, id }, include: rentalInclude });
  assert(rental, "Rental not found.");
  return rental;
}
async function vehicleFor(tx: Tx, b: Business, id: string) {
  const vehicle = await tx.vehicle.findFirst({ where: { businessId: b.id, id } });
  assert(vehicle, "Vehicle not found.");
  return vehicle;
}
async function assertAvailable(tx: Tx, b: Business, vehicleId: string, start: Date, end: Date, excludeRental?: string) {
  const conflict = await tx.allocation.findFirst({ where: { businessId: b.id, vehicleId, active: true, startAt: { lt: end }, endAt: { gt: start }, ...(excludeRental ? { OR: [{ rentalId: null }, { rentalId: { not: excludeRental } }] } : {}) } });
  assert(!conflict, "Vehicle is already reserved, rented, or scheduled for maintenance during this period.");
  const activeRental = await tx.rental.findFirst({ where: { businessId: b.id, vehicleId, state: "ACTIVE", endAt: { lt: new Date() }, ...(excludeRental ? { id: { not: excludeRental } } : {}) } });
  assert(!activeRental, "Vehicle has an overdue rental. Return it before making a new commitment.");
  const overdueWork = await tx.maintenance.findFirst({ where: { businessId: b.id, vehicleId, state: { in: ["SCHEDULED", "IN_PROGRESS"] }, endAt: { lt: new Date() } } });
  assert(!overdueWork, "Vehicle has overdue maintenance. Complete or cancel the work order first.");
}
async function issueInvoice(tx: Tx, b: Business, r: Rental, input: { key: string; description: string; subtotal: number; start?: Date; end?: Date; due?: Date; originalId?: string; tax?: number }) {
  const previous = await tx.invoice.findUnique({ where: { businessId_billingKey: { businessId: b.id, billingKey: input.key } } });
  if (previous) return previous;
  const sequence = await tx.business.update({ where: { id: b.id }, data: { nextInvoiceNumber: { increment: 1 } }, select: { nextInvoiceNumber: true } });
  const totals = input.tax === undefined ? taxTotal(input.subtotal, r.taxBps) : { subtotal: input.subtotal, tax: input.tax, total: input.subtotal + input.tax };
  const invoice = await tx.invoice.create({ data: {
    businessId: b.id, rentalId: r.id, number: `${input.originalId ? "CN" : b.invoicePrefix}-${String(sequence.nextInvoiceNumber - 1).padStart(6, "0")}`,
    kind: input.originalId ? "CREDIT_NOTE" : "INVOICE", originalInvoiceId: input.originalId,
    billingKey: input.key, description: input.description, ...totals,
    periodStart: input.start, periodEnd: input.end, dueAt: input.due ?? new Date(),
    businessSnapshot: { name: b.name, branchName: b.branchName, address: b.address, email: b.email, phone: b.phone, taxId: b.taxId, currency: b.currency },
    customerSnapshot: { name: r.customer.name, company: r.customer.company, email: r.customer.email, phone: r.customer.phone, address: r.customer.address },
  } });
  await audit(tx, b, input.originalId ? "CREDIT_ISSUED" : "INVOICE_ISSUED", "invoice", invoice.id, { number: invoice.number, total: invoice.total });
  return invoice;
}
async function billMonthly(tx: Tx, b: Business, r: Rental, now: Date) {
  const periods = monthlyPeriods(r, b.timezone);
  for (const period of periods) {
    if (period.start > now) break;
    const subtotal = period.amount + (period.index === 0 ? r.extras - r.discount : 0);
    await issueInvoice(tx, b, r, { key: `${r.id}:month:${period.index}`, description: `Monthly rental · period ${period.index + 1}`, subtotal, start: period.start, end: period.end, due: period.start });
  }
  const billed = periods.filter(p => p.start <= now);
  const next = periods.find(p => p.start > now);
  await tx.rental.update({ where: { id: r.id }, data: { billedThrough: billed.at(-1)?.end, nextBillingAt: next?.start ?? null } });
}

export async function createBusiness(ownerClerkId: string, input: z.input<typeof businessSchema>) {
  assert(ownerClerkId.length > 0, "Sign in to continue.");
  const data = businessSchema.parse(input);
  return db.$transaction(async tx => {
    // Unique ownerClerkId makes simultaneous onboarding requests safe.
    const existing = await tx.business.findUnique({ where: { ownerClerkId } });
    if (existing) return existing;
    const business = await tx.business.create({ data: { ...data, ownerClerkId } });
    await audit(tx, business, "BUSINESS_CREATED", "business", business.id);
    return business;
  });
}
export async function updateBusiness(ctx: OwnerContext, input: z.input<typeof businessSchema>) {
  const data = businessSchema.parse(input);
  return owned(ctx, async (tx, b) => {
    const hasRecords = await tx.rental.count({ where: { businessId: b.id } }) + await tx.vehicle.count({ where: { businessId: b.id } });
    assert(!hasRecords || data.currency === b.currency, "Currency cannot change after fleet or rentals are added.");
    const result = await tx.business.update({ where: { id: b.id }, data });
    await audit(tx, b, "BUSINESS_UPDATED", "business", b.id);
    return result;
  });
}
export async function saveVehicle(ctx: OwnerContext, input: z.input<typeof vehicleSchema>, id?: string) {
  const data = vehicleSchema.parse(input);
  return owned(ctx, async (tx, b) => {
    if (id) {
      const old = await vehicleFor(tx, b, id);
      assert(data.odometer >= old.odometer, "Odometer cannot decrease.");
    }
    const result = id ? await tx.vehicle.update({ where: { businessId_id: { businessId: b.id, id } }, data }) : await tx.vehicle.create({ data: { ...data, businessId: b.id } });
    await audit(tx, b, id ? "VEHICLE_UPDATED" : "VEHICLE_CREATED", "vehicle", result.id);
    return result;
  });
}
export async function setVehicleState(ctx: OwnerContext, id: string, state: "ACTIVE" | "INACTIVE") {
  assert(["ACTIVE", "INACTIVE"].includes(state), "Invalid vehicle state.");
  return owned(ctx, async (tx, b) => {
    await vehicleFor(tx, b, id);
    if (state === "INACTIVE") assert(!await tx.allocation.findFirst({ where: { businessId: b.id, vehicleId: id, active: true, endAt: { gt: new Date() } } }), "Cancel or move future commitments before archiving this vehicle.");
    const result = await tx.vehicle.update({ where: { businessId_id: { businessId: b.id, id } }, data: { state } });
    await audit(tx, b, "VEHICLE_STATE_CHANGED", "vehicle", id, { state });
    return result;
  });
}
export async function saveCustomer(ctx: OwnerContext, input: z.input<typeof customerSchema>, id?: string) {
  const data = customerSchema.parse(input);
  return owned(ctx, async (tx, b) => {
    if (id) assert(await tx.customer.findFirst({ where: { id, businessId: b.id } }), "Customer not found.");
    const result = id ? await tx.customer.update({ where: { businessId_id: { businessId: b.id, id } }, data }) : await tx.customer.create({ data: { ...data, businessId: b.id } });
    await audit(tx, b, id ? "CUSTOMER_UPDATED" : "CUSTOMER_CREATED", "customer", result.id);
    return result;
  });
}
export async function saveRental(ctx: OwnerContext, input: z.input<typeof rentalSchema>, id?: string) {
  const data = rentalSchema.parse(input);
  return owned(ctx, async (tx, b) => {
    const vehicle = await vehicleFor(tx, b, data.vehicleId);
    assert(vehicle.state !== "INACTIVE", "Vehicle is archived.");
    assert(await tx.customer.findFirst({ where: { id: data.customerId, businessId: b.id } }), "Customer not found.");
    quote({ ...data, taxBps: b.taxBps }, b.timezone);
    if (id) assert((await rentalFor(tx, b, id)).state === "QUOTE", "Only quotes can be edited directly.");
    const values = { ...data, taxBps: b.taxBps, turnaroundMinutes: b.turnaroundMinutes, termsSnapshot: b.contractTerms };
    const result = id ? await tx.rental.update({ where: { businessId_id: { businessId: b.id, id } }, data: values }) : await tx.rental.create({ data: { ...values, businessId: b.id } });
    await audit(tx, b, id ? "QUOTE_UPDATED" : "QUOTE_CREATED", "rental", result.id);
    return result;
  });
}
export async function confirmRental(ctx: OwnerContext, id: string) {
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    if (r.state === "CONFIRMED") return r;
    assert(r.state === "QUOTE", "Only quotes can be confirmed.");
    assert(r.vehicle.state !== "INACTIVE", "Vehicle is archived.");
    assert(r.customer.licenseExpiry >= today(b.timezone, r.startAt), "Driver licence expires before pickup.");
    await assertAvailable(tx, b, r.vehicleId, r.startAt, buffered(r.endAt, r.turnaroundMinutes));
    await tx.allocation.create({ data: { businessId: b.id, vehicleId: r.vehicleId, rentalId: r.id, kind: "RENTAL", startAt: r.startAt, endAt: buffered(r.endAt, r.turnaroundMinutes) } });
    await tx.rental.update({ where: { id }, data: { state: "CONFIRMED" } });
    await audit(tx, b, "RESERVATION_CONFIRMED", "rental", id);
  });
}
export async function cancelRental(ctx: OwnerContext, id: string, noShow = false) {
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    assert(["QUOTE", "CONFIRMED"].includes(r.state), "Only quotes or confirmed reservations can be cancelled.");
    if (noShow) assert(r.startAt <= new Date(), "A future pickup cannot be a no-show.");
    await tx.allocation.updateMany({ where: { businessId: b.id, rentalId: id }, data: { active: false } });
    await tx.rental.update({ where: { id }, data: { state: noShow ? "NO_SHOW" : "CANCELLED" } });
    await audit(tx, b, noShow ? "NO_SHOW" : "RENTAL_CANCELLED", "rental", id);
  });
}
export async function checkoutRental(ctx: OwnerContext, id: string, input: z.input<typeof inspectionSchema>, now = new Date()) {
  const inspection = inspectionSchema.parse(input);
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    if (r.state === "ACTIVE") return;
    assert(r.state === "CONFIRMED", "Confirm this reservation before checkout.");
    assert(now >= r.startAt && now < r.endAt, "Checkout must be within the reserved rental period.");
    assert(r.vehicle.state === "ACTIVE", "Vehicle must be marked ready before checkout.");
    assert(!await tx.maintenance.findFirst({ where: { businessId: b.id, vehicleId: r.vehicleId, state: { in: ["SCHEDULED", "IN_PROGRESS"] }, startAt: { lte: now } } }), "Complete or cancel open maintenance before checkout.");
    assert(!await tx.rental.findFirst({ where: { businessId: b.id, vehicleId: r.vehicleId, state: "ACTIVE", id: { not: id } } }), "Vehicle is still on another rental.");
    assert(r.customer.licenseExpiry >= today(b.timezone, now), "Driver licence has expired.");
    assert(r.vehicle.registrationExpiry && r.vehicle.registrationExpiry >= today(b.timezone, now), "Vehicle registration is missing or expired.");
    assert(r.vehicle.insuranceExpiry && r.vehicle.insuranceExpiry >= today(b.timezone, now), "Vehicle insurance is missing or expired.");
    assert(heldDeposit(r.transactions) >= r.depositRequired, "Record the required deposit before checkout.");
    assert(inspection.odometer >= r.vehicle.odometer, "Odometer cannot decrease.");
    await tx.inspection.create({ data: { businessId: b.id, rentalId: id, vehicleId: r.vehicleId, kind: "CHECKOUT", odometer: inspection.odometer, fuelPercent: inspection.fuelPercent, condition: inspection.condition, checklist: { exterior: true, interior: true, equipment: true }, actorClerkId: b.ownerClerkId } });
    await tx.vehicle.update({ where: { id: r.vehicleId }, data: { odometer: inspection.odometer, fuelPercent: inspection.fuelPercent } });
    await tx.rental.update({ where: { id }, data: { state: "ACTIVE" } });
    if (r.rateUnit === "MONTH") await billMonthly(tx, b, r, now);
    else await issueInvoice(tx, b, r, { key: `${id}:initial`, description: `${r.rateUnit === "DAY" ? "Daily" : "Weekly"} rental, extras and discount`, subtotal: quote(r, b.timezone).subtotal, start: r.startAt, end: r.endAt });
    await audit(tx, b, "VEHICLE_CHECKED_OUT", "rental", id);
  });
}
export async function extendRental(ctx: OwnerContext, id: string, endAt: Date) {
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    assert(["CONFIRMED", "ACTIVE"].includes(r.state), "Only confirmed or active rentals can be extended.");
    assert(endAt > r.endAt, "New return time must be later than the current return time.");
    const updated = { ...r, endAt };
    const price = quote(updated, b.timezone);
    await assertAvailable(tx, b, r.vehicleId, r.startAt, buffered(endAt, r.turnaroundMinutes), id);
    await tx.allocation.updateMany({ where: { businessId: b.id, rentalId: id, active: true }, data: { endAt: buffered(endAt, r.turnaroundMinutes) } });
    await tx.rental.update({ where: { id }, data: { endAt } });
    if (r.state === "ACTIVE" && r.rateUnit !== "MONTH") {
      const difference = price.subtotal - quote(r, b.timezone).subtotal;
      if (difference > 0) await issueInvoice(tx, b, r, { key: `${id}:extension:${endAt.toISOString()}`, description: "Rental extension", subtotal: difference, start: r.endAt, end: endAt });
    }
    if (r.state === "ACTIVE" && r.rateUnit === "MONTH") {
      // A previously issued prorated final period is immutable; top it up before continuing.
      const oldPeriods = monthlyPeriods(r, b.timezone);
      const newPeriods = monthlyPeriods(updated, b.timezone);
      for (const old of oldPeriods) {
        const issued = r.invoices.find(i => i.billingKey === `${id}:month:${old.index}`);
        const next = newPeriods[old.index];
        if (issued && next && next.amount > old.amount) await issueInvoice(tx, b, r, { key: `${id}:extension:${endAt.toISOString()}:${old.index}`, description: "Monthly rental extension adjustment", subtotal: next.amount - old.amount, start: old.end, end: next.end });
      }
      await billMonthly(tx, b, { ...r, endAt }, new Date());
    }
    await audit(tx, b, "RENTAL_EXTENDED", "rental", id, { previousEnd: r.endAt.toISOString(), endAt: endAt.toISOString() });
  });
}
export async function returnRental(ctx: OwnerContext, id: string, input: z.input<typeof inspectionSchema>, extraCharges: { fuel: number; damage: number; reason: string }, now = new Date()) {
  const inspection = inspectionSchema.parse(input);
  z.object({ fuel: z.number().int().min(0).max(2_000_000_000), damage: z.number().int().min(0).max(2_000_000_000), reason: z.string().trim().max(3000) }).parse(extraCharges);
  if (extraCharges.fuel + extraCharges.damage > 0) assert(extraCharges.reason.trim(), "Explain the fuel or damage charges.");
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    if (["RETURNED", "CLOSED"].includes(r.state)) return;
    assert(r.state === "ACTIVE", "Only active rentals can be returned.");
    assert(now > r.startAt, "Return must be after pickup.");
    assert(inspection.odometer >= r.vehicle.odometer, "Odometer cannot decrease.");
    if (r.rateUnit === "MONTH") await billMonthly(tx, b, r, new Date(Math.min(now.getTime(), r.endAt.getTime() - 1)));
    const checkouts = r.inspections.filter(i => ["CHECKOUT", "REPLACEMENT_IN"].includes(i.kind));
    const replacements = r.inspections.filter(i => i.kind === "REPLACEMENT_OUT");
    let distance = inspection.odometer - (checkouts.find(i => i.vehicleId === r.vehicleId)?.odometer ?? inspection.odometer);
    for (const out of replacements) distance += out.odometer - (checkouts.find(i => i.vehicleId === out.vehicleId)?.odometer ?? out.odometer);
    const mileage = Math.max(0, distance - r.includedKm) * r.extraKmRate;
    const late = now > r.endAt ? (r.rateUnit === "MONTH" ? Math.ceil((now.getTime() - r.endAt.getTime()) / 86_400_000) * Math.ceil(r.unitRate / 30) : quote({ ...r, endAt: now }, b.timezone).base - quote(r, b.timezone).base) : 0;
    const subtotal = mileage + late + extraCharges.fuel + extraCharges.damage;
    if (subtotal > 0) await issueInvoice(tx, b, r, { key: `${id}:return`, description: `Return charges: mileage ${mileage}, late ${late}, fuel ${extraCharges.fuel}, damage ${extraCharges.damage} (minor units). ${extraCharges.reason}`, subtotal });
    await tx.inspection.create({ data: { businessId: b.id, rentalId: id, vehicleId: r.vehicleId, kind: "RETURN", odometer: inspection.odometer, fuelPercent: inspection.fuelPercent, condition: inspection.condition, checklist: { exterior: true, interior: true, equipment: true }, actorClerkId: b.ownerClerkId, createdAt: now } });
    await tx.vehicle.update({ where: { id: r.vehicleId }, data: { odometer: inspection.odometer, fuelPercent: inspection.fuelPercent, state: "TURNAROUND" } });
    await tx.allocation.updateMany({ where: { businessId: b.id, rentalId: id }, data: { active: false } });
    await tx.rental.update({ where: { id }, data: { state: "RETURNED", actualReturnAt: now, nextBillingAt: null } });
    await audit(tx, b, "VEHICLE_RETURNED", "rental", id, { distance, late, mileage });
  });
}
export async function replaceVehicle(ctx: OwnerContext, id: string, vehicleId: string, outgoing: z.input<typeof inspectionSchema>, incoming: z.input<typeof inspectionSchema>, reason: string) {
  const out = inspectionSchema.parse(outgoing); const incomingData = inspectionSchema.parse(incoming);
  assert(reason.trim().length > 0 && reason.length <= 3000, "Enter a replacement reason.");
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    assert(r.state === "ACTIVE", "Only active rentals support replacement.");
    assert(!r.inspections.some(i => i.kind === "REPLACEMENT_OUT"), "This release supports one vehicle replacement per rental.");
    const next = await vehicleFor(tx, b, vehicleId);
    assert(next.id !== r.vehicleId && next.state === "ACTIVE", "Choose a different ready vehicle.");
    const now = new Date();
    assert(now < r.endAt, "Extend an overdue rental before replacing its vehicle.");
    assert(next.insuranceExpiry && next.insuranceExpiry >= today(b.timezone) && next.registrationExpiry && next.registrationExpiry >= today(b.timezone), "Replacement registration and insurance must be valid.");
    assert(out.odometer >= r.vehicle.odometer && incomingData.odometer >= next.odometer, "Odometer cannot decrease.");
    await assertAvailable(tx, b, next.id, now, buffered(r.endAt, r.turnaroundMinutes));
    await tx.allocation.updateMany({ where: { businessId: b.id, rentalId: id, active: true }, data: { active: false } });
    await tx.allocation.create({ data: { businessId: b.id, vehicleId: next.id, rentalId: id, kind: "RENTAL", startAt: now, endAt: buffered(r.endAt, r.turnaroundMinutes) } });
    for (const [vehicle, kind, data] of [[r.vehicleId, "REPLACEMENT_OUT", out], [next.id, "REPLACEMENT_IN", incomingData]] as const) {
      await tx.inspection.create({ data: { businessId: b.id, rentalId: id, vehicleId: vehicle, kind, odometer: data.odometer, fuelPercent: data.fuelPercent, condition: data.condition, checklist: { exterior: true, interior: true, equipment: true }, actorClerkId: b.ownerClerkId } });
      await tx.vehicle.update({ where: { id: vehicle }, data: { odometer: data.odometer, fuelPercent: data.fuelPercent, state: kind === "REPLACEMENT_OUT" ? "TURNAROUND" : "ACTIVE" } });
    }
    await tx.rental.update({ where: { id }, data: { vehicleId: next.id } });
    await audit(tx, b, "VEHICLE_REPLACED", "rental", id, { from: r.vehicleId, to: next.id, reason });
  });
}
export async function recordMoney(ctx: OwnerContext, input: { rentalId: string; invoiceId?: string; kind: "PAYMENT" | "PAYMENT_REFUND" | "DEPOSIT_RECEIVED" | "DEPOSIT_REFUND" | "DEPOSIT_APPLIED" | "DEPOSIT_RESTORED"; amount: number; method: string; reference: string; reason: string; requestKey: string }) {
  const data = z.object({ rentalId: z.string().min(1), invoiceId: z.string().optional(), kind: z.enum(["PAYMENT", "PAYMENT_REFUND", "DEPOSIT_RECEIVED", "DEPOSIT_REFUND", "DEPOSIT_APPLIED", "DEPOSIT_RESTORED"]), amount: z.number().int().positive().max(2_000_000_000), method: z.enum(["CASH", "BANK", "CARD"]), reference: z.string().max(200), reason: z.string().max(1000), requestKey: z.uuid() }).parse(input);
  return owned(ctx, async (tx, b) => {
    const previous = await tx.moneyTransaction.findUnique({ where: { businessId_requestKey: { businessId: b.id, requestKey: data.requestKey } } });
    if (previous) { assert(previous.rentalId === data.rentalId && previous.kind === data.kind && previous.amount === data.amount && previous.invoiceId === (data.invoiceId ?? null), "This request was already used for a different transaction."); return previous; }
    const r = await rentalFor(tx, b, data.rentalId);
    assert(r.state !== "CLOSED", "Rental is financially closed.");
    const deposit = heldDeposit(r.transactions);
    if (["DEPOSIT_REFUND", "DEPOSIT_APPLIED"].includes(data.kind)) assert(data.amount <= deposit, "Amount exceeds the deposit held.");
    if (["DEPOSIT_RECEIVED"].includes(data.kind)) assert(["CONFIRMED", "ACTIVE"].includes(r.state), "Deposits can only be received for confirmed or active rentals.");
    if (["DEPOSIT_RECEIVED", "DEPOSIT_REFUND"].includes(data.kind)) assert(!data.invoiceId, "Deposit receipts and refunds are separate from invoices.");
    if (["PAYMENT", "PAYMENT_REFUND", "DEPOSIT_APPLIED", "DEPOSIT_RESTORED"].includes(data.kind)) {
      const invoice = r.invoices.find(i => i.id === data.invoiceId && i.kind === "INVOICE");
      assert(invoice, "Select an invoice belonging to this rental.");
      const balance = invoiceBalance(invoice, r.invoices, r.transactions);
      if (data.kind === "PAYMENT_REFUND") {
        const collected = r.transactions.filter(t => t.invoiceId === invoice.id).reduce((n, t) => n + (t.kind === "PAYMENT" ? t.amount : t.kind === "PAYMENT_REFUND" ? -t.amount : 0), 0);
        assert(data.amount <= collected && data.amount <= -balance, "Issue a credit note first; refund cannot exceed the invoice overpayment or externally collected amount.");
      } else if (data.kind === "DEPOSIT_RESTORED") {
        const applied = r.transactions.filter(t => t.invoiceId === invoice.id).reduce((n, t) => n + (t.kind === "DEPOSIT_APPLIED" ? t.amount : t.kind === "DEPOSIT_RESTORED" ? -t.amount : 0), 0);
        assert(data.amount <= applied && data.amount <= -balance, "Issue a credit note first. Restoration cannot exceed the credited overpayment or previously applied deposit.");
      } else assert(data.amount <= balance, "Amount exceeds the invoice balance.");
    }
    if (["PAYMENT_REFUND", "DEPOSIT_REFUND", "DEPOSIT_APPLIED", "DEPOSIT_RESTORED"].includes(data.kind)) assert(data.reason.trim(), "Enter a reason for this transaction.");
    const result = await tx.moneyTransaction.create({ data: { ...data, method: ["DEPOSIT_APPLIED", "DEPOSIT_RESTORED"].includes(data.kind) ? "DEPOSIT" : data.method, businessId: b.id, actorClerkId: b.ownerClerkId } });
    await audit(tx, b, data.kind, "transaction", result.id, { amount: data.amount, rentalId: r.id });
    return result;
  });
}
export async function creditInvoice(ctx: OwnerContext, id: string, subtotal: number, reason: string, requestKey: string) {
  z.uuid().parse(requestKey); assert(Number.isInteger(subtotal) && subtotal > 0, "Enter a positive credit amount.");
  assert(reason.trim().length > 0 && reason.length <= 1000, "Enter a reason for the credit note.");
  return owned(ctx, async (tx, b) => {
    const invoice = await tx.invoice.findFirst({ where: { id, businessId: b.id, kind: "INVOICE" } });
    assert(invoice, "Invoice not found.");
    const r = await rentalFor(tx, b, invoice.rentalId);
    const previous = await tx.invoice.findUnique({ where: { businessId_billingKey: { businessId: b.id, billingKey: `credit:${requestKey}` } } });
    if (previous) { assert(previous.originalInvoiceId === id && previous.subtotal === subtotal, "Credit request already used."); return previous; }
    assert(r.state !== "CLOSED", "Credit notes must be issued before financial closeout.");
    const credits = r.invoices.filter(i => i.originalInvoiceId === invoice.id);
    const remaining = invoice.subtotal - credits.reduce((n, i) => n + i.subtotal, 0);
    assert(subtotal <= remaining, "Credit exceeds the remaining invoice subtotal.");
    const remainingTax = invoice.tax - credits.reduce((n, i) => n + i.tax, 0);
    const tax = subtotal === remaining ? remainingTax : Math.min(remainingTax, Math.round(invoice.tax * subtotal / Math.max(1, invoice.subtotal)));
    return issueInvoice(tx, b, r, { key: `credit:${requestKey}`, description: reason, subtotal, tax, originalId: invoice.id });
  });
}
export async function closeRental(ctx: OwnerContext, id: string) {
  return owned(ctx, async (tx, b) => {
    const r = await rentalFor(tx, b, id);
    if (r.state === "CLOSED") return;
    assert(["RETURNED", "CANCELLED", "NO_SHOW"].includes(r.state), "Return or cancel the rental first.");
    assert(heldDeposit(r.transactions) === 0, "Refund or apply the remaining deposit before closeout.");
    assert(rentalBalance(r.invoices, r.transactions) === 0, "Settle all rental balances before closeout.");
    assert(r.invoices.filter(i => i.kind === "INVOICE").every(i => invoiceBalance(i, r.invoices, r.transactions) === 0), "Settle each invoice before closeout.");
    await tx.rental.update({ where: { id }, data: { state: "CLOSED" } });
    await audit(tx, b, "RENTAL_CLOSED", "rental", id);
  });
}
export async function createMaintenance(ctx: OwnerContext, input: { vehicleId: string; title: string; supplier: string; startAt: Date; endAt: Date; cost: number; notes: string }) {
  const data = z.object({ vehicleId: z.string().min(1), title: z.string().trim().min(1).max(200), supplier: z.string().max(200), startAt: z.date(), endAt: z.date(), cost: z.number().int().min(0).max(2_000_000_000), notes: z.string().max(3000) }).parse(input);
  interval(data.startAt, data.endAt);
  return owned(ctx, async (tx, b) => {
    const vehicle = await vehicleFor(tx, b, data.vehicleId);
    assert(vehicle.state !== "INACTIVE", "Vehicle is archived.");
    await assertAvailable(tx, b, data.vehicleId, data.startAt, data.endAt);
    const work = await tx.maintenance.create({ data: { ...data, businessId: b.id } });
    await tx.allocation.create({ data: { businessId: b.id, vehicleId: data.vehicleId, maintenanceId: work.id, kind: "MAINTENANCE", startAt: data.startAt, endAt: data.endAt } });
    await audit(tx, b, "MAINTENANCE_CREATED", "maintenance", work.id);
    return work;
  });
}
export async function updateMaintenance(ctx: OwnerContext, id: string, state: "IN_PROGRESS" | "COMPLETED" | "CANCELLED", actualCost: number) {
  z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]).parse(state); z.number().int().min(0).max(2_000_000_000).parse(actualCost);
  return owned(ctx, async (tx, b) => {
    const work = await tx.maintenance.findFirst({ where: { id, businessId: b.id } });
    assert(work, "Work order not found.");
    assert(["SCHEDULED", "IN_PROGRESS"].includes(work.state), "This work order is already closed.");
    if (state === "IN_PROGRESS") assert(work.startAt <= new Date(), "Work cannot start before its reserved time.");
    await tx.maintenance.update({ where: { id }, data: { state, cost: actualCost } });
    if (state !== "IN_PROGRESS") await tx.allocation.updateMany({ where: { businessId: b.id, maintenanceId: id }, data: { active: false } });
    await audit(tx, b, `MAINTENANCE_${state}`, "maintenance", id);
  });
}
export async function runMonthlyBilling(now = new Date()) {
  const businesses = await db.business.findMany({ where: { rentals: { some: { state: "ACTIVE", rateUnit: "MONTH" } } } });
  let count = 0;
  for (const b of businesses) await owned(b, async (tx, business) => {
    const rentals = await tx.rental.findMany({ where: { businessId: b.id, state: "ACTIVE", rateUnit: "MONTH" }, include: rentalInclude });
    for (const r of rentals) { await billMonthly(tx, business, r, new Date(Math.min(now.getTime(), r.endAt.getTime() - 1))); count++; }
  });
  return count;
}
export function publicError(error: unknown) {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError) return error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" · ");
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "A record with those identifiers already exists. Refresh and check before retrying.";
    if (error.code === "P2004" || error.code === "P2010") return "This change conflicts with another booking or a database integrity rule.";
  }
  console.error("RentOps operation failed", error instanceof Error ? error.name : "UnknownError");
  return "Unable to save this change. Check the configuration and try again.";
}
