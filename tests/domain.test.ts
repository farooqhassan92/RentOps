import { describe, expect, it } from "vitest";
import { csv, dateOnly, dateTime, heldDeposit, invoiceBalance, monthBoundary, moneyInput, parseMoney, quote, taxTotal } from "../src/lib/domain";
describe("money and tax", () => {
  it("parses without floating-point errors and respects currency precision", () => { expect(parseMoney("123.45", "USD")).toBe(12345); expect(parseMoney("100", "JPY")).toBe(100); expect(parseMoney("1.234", "KWD")).toBe(1234); expect(moneyInput(1234, "KWD")).toBe("1.234"); });
  it("rejects invalid, negative, excessive-precision and oversized amounts", () => { for (const v of ["-2", "1,200", "1.001", "NaN", "", "9999999999999"]) expect(() => parseMoney(v, "USD")).toThrow(); });
  it("calculates tax in minor units", () => expect(taxTotal(10005, 2000)).toEqual({ subtotal: 10005, tax: 2001, total: 12006 }));
});
describe("rental pricing", () => {
  const base = { startAt: new Date("2026-01-01T12:00Z"), endAt: new Date("2026-01-02T12:01Z"), rateUnit: "DAY" as const, unitRate: 5000, extras: 1000, discount: 500, taxBps: 1000 };
  it("rounds started daily and weekly periods up", () => { expect(quote(base, "UTC").total).toBe(11550); expect(quote({ ...base, rateUnit: "WEEK" }, "UTC").base).toBe(5000); });
  it("preserves a January 31 monthly anchor across February", () => { const a = new Date("2026-01-31T09:00Z"); expect(monthBoundary(a, 1, "UTC").toISOString()).toBe("2026-02-28T09:00:00.000Z"); expect(monthBoundary(a, 2, "UTC").toISOString()).toBe("2026-03-31T09:00:00.000Z"); expect(quote({ ...base, startAt: a, endAt: new Date("2026-03-31T09:00Z"), rateUnit: "MONTH", extras: 0, discount: 0 }, "UTC").base).toBe(10000); });
  it("prorates partial months", () => expect(quote({ ...base, startAt: new Date("2026-04-01T10:00Z"), endAt: new Date("2026-04-16T10:00Z"), rateUnit: "MONTH", unitRate: 30000, extras: 0, discount: 0 }, "UTC").base).toBe(15000));
  it("rejects reverse intervals and discounts larger than charges", () => { expect(() => quote({ ...base, endAt: base.startAt }, "UTC")).toThrow(); expect(() => quote({ ...base, discount: 999999 }, "UTC")).toThrow(); });
  it("handles real local time and rejects impossible dates", () => { expect(dateTime("2026-01-01T12:00", "Europe/Kyiv").toISOString()).toBe("2026-01-01T10:00:00.000Z"); expect(() => dateOnly("2026-02-30")).toThrow(); expect(() => dateTime("2026-03-29T03:30", "Europe/Kyiv")).toThrow(); });
});
describe("financial balances and exports", () => {
  it("separates deposits from invoice payments", () => { const i = { id: "i", kind: "INVOICE", total: 10000 }; const tx = [{ kind: "DEPOSIT_RECEIVED", amount: 15000 }, { kind: "DEPOSIT_APPLIED", amount: 4000, invoiceId: "i" }, { kind: "PAYMENT", amount: 3000, invoiceId: "i" }]; expect(heldDeposit(tx)).toBe(11000); expect(invoiceBalance(i, [i], tx)).toBe(3000); });
  it("retains refund liabilities after crediting a paid invoice", () => { const i = { id: "i", kind: "INVOICE", total: 10000 }; expect(invoiceBalance(i, [i, { id: "c", kind: "CREDIT_NOTE", originalInvoiceId: "i", total: 3000 }], [{ kind: "PAYMENT", invoiceId: "i", amount: 10000 }])).toBe(-3000); });
  it("escapes cells and neutralizes spreadsheet formula injection", () => { const out = csv([["=CMD()", 'a"b', "x,y"]]); expect(out).toContain('"\'=CMD()"'); expect(out).toContain('"a""b"'); expect(out).toContain('"x,y"'); });
});
