import { Client } from "pg";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const connection = new URL(process.env.TEST_DATABASE_URL || "postgresql://rentops:rentops_local@127.0.0.1:55432/postgres");
const name = `rentops_test_${Date.now()}`;
const admin = new Client({ connectionString: connection.toString() }); await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
connection.pathname = `/${name}`; process.env.DATABASE_URL = connection.toString();
const client = new Client({ connectionString: connection.toString() }); await client.connect();
let checks = 0;
async function check(label: string, fn: () => Promise<void>) { await fn(); console.log(`PASS ${label}`); checks++; }
let disconnect: (() => Promise<void>) | undefined;
try {
  for (const file of ["202610200001_initial", "202610200002_integrity", "202610200003_deposit_restore", "202610200004_deposit_restore_rule"]) await client.query(await readFile(`prisma/migrations/${file}/migration.sql`, "utf8"));
  const s = await import("../src/lib/service"); const { db } = await import("../src/lib/db"); disconnect = () => db.$disconnect();
  const domain = await import("../src/lib/domain");
  const business = { name: "Integration Test", branchName: "Only branch", country: "Test", currency: "USD", timezone: "UTC", address: "", email: "", phone: "", taxId: "", taxBps: 1000, turnaroundMinutes: 120, invoicePrefix: "INV", contractTerms: "Test terms" };
  const a = await s.createBusiness("test_owner_a", business); const b = await s.createBusiness("test_owner_b", business);
  const vehicleInput = { plate: "TEST-01", vin: "", make: "Toyota", model: "Corolla", year: 2025, category: "Sedan", color: "Silver", odometer: 100, fuelPercent: 100, dailyRate: 5000, weeklyRate: 30000, monthlyRate: 100000, depositRequired: 10000, registrationExpiry: new Date("2030-12-31"), insuranceExpiry: new Date("2030-12-31"), serviceDueDate: null, serviceDueKm: null, notes: "" };
  const va = await s.saveVehicle(a, vehicleInput); const vb = await s.saveVehicle(b, vehicleInput);
  const customerInput = { name: "Test Driver", company: "", email: "test@example.com", phone: "123", address: "", licenseNumber: "LIC1", licenseExpiry: new Date("2030-12-31"), notes: "" };
  const ca = await s.saveCustomer(a, customerInput); const cb = await s.saveCustomer(b, customerInput);
  const now = new Date(); const start = new Date(now.getTime() - 3600000); const end = new Date(now.getTime() + 23 * 3600000);
  const rentalInput = { vehicleId: va.id, customerId: ca.id, startAt: start, endAt: end, rateUnit: "DAY" as const, unitRate: 5000, depositRequired: 10000, includedKm: 100, extraKmRate: 100, extras: 0, discount: 0, notes: "" };
  await check("one business per Clerk account", async () => assert.equal((await s.createBusiness(a.ownerClerkId, business)).id, a.id));
  await check("forged owner context rejected", async () => { await assert.rejects(s.saveVehicle({ id: a.id, ownerClerkId: b.ownerClerkId }, { ...vehicleInput, plate: "FORGED" })); });
  await check("cross-tenant rental references rejected", async () => { await assert.rejects(s.saveRental(a, { ...rentalInput, vehicleId: vb.id })); await assert.rejects(s.saveRental(a, { ...rentalInput, customerId: cb.id })); });
  await check("cross-tenant database foreign key enforced", async () => { await assert.rejects(db.rental.create({ data: { ...rentalInput, businessId: a.id, vehicleId: vb.id, taxBps: 0, turnaroundMinutes: 0, termsSnapshot: "" } })); });
  const r = await s.saveRental(a, rentalInput); const conflict = await s.saveRental(a, rentalInput);
  await check("simultaneous confirmation cannot double-book", async () => { const results = await Promise.allSettled([s.confirmRental(a, r.id), s.confirmRental(a, conflict.id)]); assert.equal(results.filter(x => x.status === "fulfilled").length, 1); });
  const confirmed = await db.rental.findFirstOrThrow({ where: { businessId: a.id, state: "CONFIRMED" } }); const rid = confirmed.id;
  await check("PostgreSQL exclusion constraint prevents direct conflicting allocations", async () => { await assert.rejects(db.allocation.create({ data: { businessId: a.id, vehicleId: va.id, rentalId: rid, kind: "RENTAL", startAt: start, endAt: end } })); });
  await check("maintenance cannot overlap a reservation", async () => { await assert.rejects(s.createMaintenance(a, { vehicleId: va.id, title: "Service", supplier: "", startAt: start, endAt: end, cost: 0, notes: "" })); });
  const inspection = { odometer: 100, fuelPercent: 100, condition: "Good", exterior: true, interior: true, equipment: true };
  await check("checkout requires deposit", async () => { await assert.rejects(s.checkoutRental(a, rid, inspection)); });
  const deposit = { rentalId: rid, kind: "DEPOSIT_RECEIVED" as const, amount: 10000, method: "CASH", reference: "test", reason: "", requestKey: randomUUID() };
  await check("payment retries are idempotent", async () => { const x = await s.recordMoney(a, deposit); const y = await s.recordMoney(a, deposit); assert.equal(x.id, y.id); assert.equal(await db.moneyTransaction.count({ where: { rentalId: rid } }), 1); });
  await check("foreign rental payment rejected", async () => { await assert.rejects(s.recordMoney(b, { ...deposit, requestKey: randomUUID() })); });
  await check("checkout creates one invoice and inspection", async () => { await s.checkoutRental(a, rid, inspection); await s.checkoutRental(a, rid, inspection); assert.equal(await db.invoice.count({ where: { rentalId: rid } }), 1); assert.equal(await db.inspection.count({ where: { rentalId: rid } }), 1); });
  await check("issued invoices cannot be overwritten", async () => { const i = await db.invoice.findFirstOrThrow({ where: { rentalId: rid } }); await assert.rejects(db.invoice.update({ where: { id: i.id }, data: { total: 0 } })); });
  await check("deposit over-refund rejected", async () => { await assert.rejects(s.recordMoney(a, { ...deposit, kind: "DEPOSIT_REFUND", amount: 10001, reason: "Refund", requestKey: randomUUID() })); });
  await check("physical return succeeds while money is owed", async () => { await s.returnRental(a, rid, { ...inspection, odometer: 150 }, { fuel: 0, damage: 0, reason: "" }); assert.equal((await db.rental.findUniqueOrThrow({ where: { id: rid } })).state, "RETURNED"); assert.equal((await db.vehicle.findUniqueOrThrow({ where: { id: va.id } })).state, "TURNAROUND"); });
  await check("unsettled rental cannot close", async () => { await assert.rejects(s.closeRental(a, rid)); });
  const invoice = await db.invoice.findFirstOrThrow({ where: { rentalId: rid } });
  await check("deposit can pay invoice and remainder can be refunded", async () => { await s.recordMoney(a, { ...deposit, kind: "DEPOSIT_APPLIED", invoiceId: invoice.id, amount: invoice.total, reason: "Settle invoice", requestKey: randomUUID() }); await s.recordMoney(a, { ...deposit, kind: "DEPOSIT_REFUND", amount: 10000 - invoice.total, reason: "Return balance", requestKey: randomUUID() }); await s.closeRental(a, rid); assert.equal((await db.rental.findUniqueOrThrow({ where: { id: rid } })).state, "CLOSED"); });
  await check("closed rental rejects new financial entries", async () => { await assert.rejects(s.recordMoney(a, { ...deposit, requestKey: randomUUID() })); });
  const vm = await s.saveVehicle(a, { ...vehicleInput, plate: "MONTHLY", depositRequired: 0 });
  const monthly = await s.saveRental(a, { ...rentalInput, vehicleId: vm.id, depositRequired: 0, rateUnit: "MONTH", unitRate: 100000, startAt: new Date(now.getTime() - 40 * 86400000), endAt: new Date(now.getTime() + 30 * 86400000) }); await s.confirmRental(a, monthly.id);
  await check("monthly billing catches up and retries without duplicate invoices", async () => { await s.checkoutRental(a, monthly.id, inspection); const before = await db.invoice.count({ where: { rentalId: monthly.id } }); assert.ok(before >= 2); await s.runMonthlyBilling(); await s.runMonthlyBilling(); assert.equal(await db.invoice.count({ where: { rentalId: monthly.id } }), before); });
  await check("over-credit and overpayment rejected", async () => { const i = await db.invoice.findFirstOrThrow({ where: { rentalId: monthly.id } }); await assert.rejects(s.creditInvoice(a, i.id, i.subtotal + 1, "Too much", randomUUID())); await assert.rejects(s.recordMoney(a, { ...deposit, rentalId: monthly.id, invoiceId: i.id, kind: "PAYMENT", amount: i.total + 1, requestKey: randomUUID() })); });
  await check("credit-note retry is idempotent", async () => { const i = await db.invoice.findFirstOrThrow({ where: { rentalId: monthly.id } }); const key = randomUUID(); const first = await s.creditInvoice(a, i.id, 1000, "Agreed reduction", key); const second = await s.creditInvoice(a, i.id, 1000, "Agreed reduction", key); assert.equal(first.id, second.id); });
  await check("cross-tenant financial documents cannot be credited", async () => { const i = await db.invoice.findFirstOrThrow({ where: { rentalId: monthly.id } }); await assert.rejects(s.creditInvoice(b, i.id, 100, "Foreign", randomUUID())); });
  await check("deposit totals remain nonnegative", async () => { const tx = await db.moneyTransaction.findMany({ where: { businessId: a.id } }); assert.equal(domain.heldDeposit(tx), 0); });
  await check("credited applied deposits can be restored and refunded", async () => {
    const invoice = await db.invoice.findFirstOrThrow({ where: { rentalId: monthly.id, kind: "INVOICE" } });
    await s.recordMoney(a, { ...deposit, rentalId: monthly.id, amount: 2000, requestKey: randomUUID() });
    await s.recordMoney(a, { ...deposit, rentalId: monthly.id, invoiceId: invoice.id, kind: "DEPOSIT_APPLIED", amount: 2000, reason: "Apply deposit", requestKey: randomUUID() });
    const credits = await db.invoice.findMany({ where: { originalInvoiceId: invoice.id } });
    await s.creditInvoice(a, invoice.id, invoice.subtotal - credits.reduce((n, i) => n + i.subtotal, 0), "Full reduction", randomUUID());
    await s.recordMoney(a, { ...deposit, rentalId: monthly.id, invoiceId: invoice.id, kind: "DEPOSIT_RESTORED", amount: 2000, reason: "Restore credited amount", requestKey: randomUUID() });
    await s.recordMoney(a, { ...deposit, rentalId: monthly.id, kind: "DEPOSIT_REFUND", amount: 2000, reason: "Refund restored funds", requestKey: randomUUID() });
    assert.equal(domain.heldDeposit(await db.moneyTransaction.findMany({ where: { rentalId: monthly.id } })), 0);
  });
  await check("active extension detects future commitments", async () => {
    const future = await s.saveRental(a, { ...rentalInput, vehicleId: vm.id, startAt: new Date(monthly.endAt.getTime() + 3 * 3600000), endAt: new Date(monthly.endAt.getTime() + 27 * 3600000), depositRequired: 0 });
    await s.confirmRental(a, future.id);
    await assert.rejects(s.extendRental(a, monthly.id, new Date(monthly.endAt.getTime() + 86400000)));
    await s.cancelRental(a, future.id);
    await s.extendRental(a, monthly.id, new Date(monthly.endAt.getTime() + 86400000));
  });
  await check("overdue maintenance blocks new bookings", async () => {
    const v = await s.saveVehicle(a, { ...vehicleInput, plate: "SERVICE" });
    await s.createMaintenance(a, { vehicleId: v.id, title: "Overdue service", supplier: "", startAt: new Date(now.getTime() - 3 * 86400000), endAt: new Date(now.getTime() - 2 * 86400000), cost: 0, notes: "" });
    const pending = await s.saveRental(a, { ...rentalInput, vehicleId: v.id });
    await assert.rejects(s.confirmRental(a, pending.id));
  });
  console.log(`\n${checks} PostgreSQL integration checks passed.`);
} finally {
  await disconnect?.(); await client.end();
  // The generated database name is internal and never points at an existing database.
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
}
