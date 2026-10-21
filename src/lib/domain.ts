import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export class DomainError extends Error {}
export const MAX_MONEY = 2_000_000_000;
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message);
}
export function currencyDigits(currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function parseMoney(value: string, currency: string): number {
  const digits = currencyDigits(currency);
  assert(/^\d+(\.\d+)?$/.test(value.trim()), "Enter a non-negative amount without commas.");
  const [whole, fraction = ""] = value.trim().split(".");
  assert(fraction.length <= digits, `This currency supports ${digits} decimal places.`);
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  assert(Number.isSafeInteger(amount) && amount <= MAX_MONEY, "Amount is too large.");
  return amount;
}
export function money(value: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(value / 10 ** currencyDigits(currency));
}
export function moneyInput(value: number, currency: string) {
  return (value / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));
}
export function taxTotal(subtotal: number, taxBps: number) {
  assert(Number.isInteger(subtotal) && subtotal >= 0, "Invalid subtotal.");
  assert(Number.isInteger(taxBps) && taxBps >= 0 && taxBps <= 10000, "Invalid tax rate.");
  const tax = Math.round(subtotal * taxBps / 10000);
  assert(subtotal + tax <= MAX_MONEY, "Invoice total is too large.");
  return { subtotal, tax, total: subtotal + tax };
}
export function dateTime(value: string, timezone: string) {
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Enter a complete local date and time.");
  const result = fromZonedTime(value, timezone);
  assert(!Number.isNaN(result.getTime()) && formatInTimeZone(result, timezone, "yyyy-MM-dd'T'HH:mm") === value,
    "This local time does not exist. Check the timezone or daylight-saving transition.");
  return result;
}
export function localInput(value: Date, timezone: string) { return formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm"); }
export function dateLabel(value: Date | string, timezone: string, pattern = "dd MMM yyyy, HH:mm") {
  return formatInTimeZone(new Date(value), timezone, pattern);
}
export function dateOnly(value: string) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.");
  const result = new Date(value + "T00:00:00Z");
  assert(!Number.isNaN(result.getTime()) && result.toISOString().slice(0, 10) === value, "Enter a valid date.");
  return result;
}
export function today(timezone: string, now = new Date()) { return dateOnly(formatInTimeZone(now, timezone, "yyyy-MM-dd")); }
export function interval(start: Date, end: Date) { assert(end > start, "Return/end time must be after the start."); }
export function overlaps(a: Date, b: Date, c: Date, d: Date) { return a < d && c < b; }
export function buffered(end: Date, minutes: number) { return new Date(end.getTime() + minutes * 60_000); }
export function monthBoundary(anchor: Date, offset: number, timezone: string) {
  const parts = formatInTimeZone(anchor, timezone, "yyyy-MM-dd'T'HH:mm");
  const [date, time] = parts.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const days = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const local = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, days)).padStart(2, "0")}T${time}`;
  // DST gaps advance naturally according to the timezone conversion.
  return fromZonedTime(local, timezone);
}
export type Pricing = { startAt: Date; endAt: Date; rateUnit: "DAY" | "WEEK" | "MONTH"; unitRate: number; extras: number; discount: number; taxBps: number };
export function monthlyPeriods(input: Pricing, timezone: string) {
  const periods: { start: Date; end: Date; amount: number; index: number }[] = [];
  for (let i = 0; i < 1200; i++) {
    const start = monthBoundary(input.startAt, i, timezone);
    if (start >= input.endAt) break;
    const boundary = monthBoundary(input.startAt, i + 1, timezone);
    const end = boundary < input.endAt ? boundary : input.endAt;
    periods.push({ start, end, amount: Math.round(input.unitRate * ((end.getTime() - start.getTime()) / (boundary.getTime() - start.getTime()))), index: i });
  }
  assert(periods.length > 0 && periods.at(-1)!.end.getTime() === input.endAt.getTime(), "Rental duration must be less than 100 years.");
  return periods;
}
export function quote(input: Pricing, timezone: string) {
  interval(input.startAt, input.endAt);
  assert(input.unitRate > 0, "Rental rate must be greater than zero.");
  const base = input.rateUnit === "MONTH"
    ? monthlyPeriods(input, timezone).reduce((n, p) => n + p.amount, 0)
    : Math.ceil((input.endAt.getTime() - input.startAt.getTime()) / (input.rateUnit === "WEEK" ? 604_800_000 : 86_400_000)) * input.unitRate;
  assert(input.discount <= base + input.extras, "Discount exceeds the rental charges.");
  if (input.rateUnit === "MONTH") assert(input.discount <= monthlyPeriods(input, timezone)[0].amount + input.extras, "Monthly discounts must fit in the first billing period.");
  return { base, ...taxTotal(base + input.extras - input.discount, input.taxBps) };
}
export type MoneyEntry = { kind: string; amount: number; invoiceId?: string | null };
export type InvoiceEntry = { id: string; kind: string; total: number; originalInvoiceId?: string | null };
export function heldDeposit(entries: MoneyEntry[]) {
  return entries.reduce((n, t) => n + (["DEPOSIT_RECEIVED", "DEPOSIT_RESTORED"].includes(t.kind) ? t.amount : ["DEPOSIT_REFUND", "DEPOSIT_APPLIED"].includes(t.kind) ? -t.amount : 0), 0);
}
export function invoiceBalance(invoice: InvoiceEntry, invoices: InvoiceEntry[], transactions: MoneyEntry[]) {
  const credits = invoices.filter(i => i.kind === "CREDIT_NOTE" && i.originalInvoiceId === invoice.id).reduce((n, i) => n + i.total, 0);
  const paid = transactions.filter(t => t.invoiceId === invoice.id).reduce((n, t) => n + (["PAYMENT", "DEPOSIT_APPLIED"].includes(t.kind) ? t.amount : ["PAYMENT_REFUND", "DEPOSIT_RESTORED"].includes(t.kind) ? -t.amount : 0), 0);
  return invoice.total - credits - paid;
}
export function rentalBalance(invoices: InvoiceEntry[], transactions: MoneyEntry[]) {
  return invoices.filter(i => i.kind === "INVOICE").reduce((n, i) => n + invoiceBalance(i, invoices, transactions), 0);
}
export function csv(rows: (string | number)[][]) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    const s = String(value);
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}
