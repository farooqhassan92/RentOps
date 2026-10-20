"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { requireBusiness, requireUser } from "@/lib/auth";
import { dateOnly, dateTime, parseMoney, assert } from "@/lib/domain";
import * as service from "@/lib/service";
import { db } from "@/lib/db";
import { privateDirectory, privateFile } from "@/lib/storage";
export type ActionResult = { error?: string };
const s = (form: FormData, name: string) => String(form.get(name) ?? "");
const n = (form: FormData, name: string) => Number(s(form, name));
const optionalDate = (form: FormData, name: string) => s(form, name) ? dateOnly(s(form, name)) : null;
const inspection = (f: FormData, prefix = "") => ({ odometer: n(f, prefix + "odometer"), fuelPercent: n(f, prefix + "fuelPercent"), condition: s(f, prefix + "condition"), exterior: f.get(prefix + "exterior") === "on", interior: f.get(prefix + "interior") === "on", equipment: f.get(prefix + "equipment") === "on" });
const businessData = (f: FormData) => ({ name: s(f, "name"), branchName: s(f, "branchName"), country: s(f, "country"), currency: s(f, "currency"), timezone: s(f, "timezone"), address: s(f, "address"), email: s(f, "email"), phone: s(f, "phone"), taxId: s(f, "taxId"), taxBps: Math.round(n(f, "taxRate") * 100), turnaroundMinutes: n(f, "turnaroundMinutes"), invoicePrefix: s(f, "invoicePrefix"), contractTerms: s(f, "contractTerms") });
function done(url: string): never { revalidatePath("/", "layout"); redirect(url); }
export async function onboardingAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const owner = await requireUser();
  try { await service.createBusiness(owner, businessData(f)); } catch (e) { return { error: service.publicError(e) }; }
  done("/dashboard");
}
export async function settingsAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try { await service.updateBusiness(b, businessData(f)); } catch (e) { return { error: service.publicError(e) }; }
  done("/settings?saved=1");
}
export async function vehicleAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness(); let id: string;
  try {
    const result = await service.saveVehicle(b, { plate: s(f, "plate"), vin: s(f, "vin"), make: s(f, "make"), model: s(f, "model"), year: n(f, "year"), category: s(f, "category"), color: s(f, "color"), odometer: n(f, "odometer"), fuelPercent: n(f, "fuelPercent"), dailyRate: parseMoney(s(f, "dailyRate"), b.currency), weeklyRate: parseMoney(s(f, "weeklyRate"), b.currency), monthlyRate: parseMoney(s(f, "monthlyRate"), b.currency), depositRequired: parseMoney(s(f, "depositRequired") || "0", b.currency), registrationExpiry: optionalDate(f, "registrationExpiry"), insuranceExpiry: optionalDate(f, "insuranceExpiry"), serviceDueDate: optionalDate(f, "serviceDueDate"), serviceDueKm: s(f, "serviceDueKm") ? n(f, "serviceDueKm") : null, notes: s(f, "notes") }, s(f, "id") || undefined);
    id = result.id;
  } catch (e) { return { error: service.publicError(e) }; }
  done(`/vehicles/${id}`);
}
export async function vehicleStateAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try { await service.setVehicleState(b, s(f, "id"), s(f, "state") as "ACTIVE" | "INACTIVE"); } catch (e) { return { error: service.publicError(e) }; }
  done(`/vehicles/${encodeURIComponent(s(f, "id"))}`);
}
export async function customerAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness(); let id: string;
  try { const result = await service.saveCustomer(b, { name: s(f, "name"), company: s(f, "company"), email: s(f, "email"), phone: s(f, "phone"), address: s(f, "address"), licenseNumber: s(f, "licenseNumber"), licenseExpiry: dateOnly(s(f, "licenseExpiry")), notes: s(f, "notes") }, s(f, "id") || undefined); id = result.id; } catch (e) { return { error: service.publicError(e) }; }
  done(`/customers/${id}`);
}
export async function rentalAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness(); let id: string;
  try {
    const result = await service.saveRental(b, { vehicleId: s(f, "vehicleId"), customerId: s(f, "customerId"), startAt: dateTime(s(f, "startAt"), b.timezone), endAt: dateTime(s(f, "endAt"), b.timezone), rateUnit: s(f, "rateUnit") as "DAY" | "WEEK" | "MONTH", unitRate: parseMoney(s(f, "unitRate"), b.currency), depositRequired: parseMoney(s(f, "depositRequired") || "0", b.currency), includedKm: n(f, "includedKm"), extraKmRate: parseMoney(s(f, "extraKmRate") || "0", b.currency), extras: parseMoney(s(f, "extras") || "0", b.currency), discount: parseMoney(s(f, "discount") || "0", b.currency), notes: s(f, "notes") }, s(f, "id") || undefined); id = result.id;
  } catch (e) { return { error: service.publicError(e) }; }
  done(`/rentals/${id}`);
}
export async function rentalCommandAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness(); const id = s(f, "id");
  try {
    switch (s(f, "command")) {
      case "confirm": await service.confirmRental(b, id); break;
      case "cancel": await service.cancelRental(b, id); break;
      case "no-show": await service.cancelRental(b, id, true); break;
      case "checkout": await service.checkoutRental(b, id, inspection(f)); break;
      case "return": await service.returnRental(b, id, inspection(f), { fuel: parseMoney(s(f, "fuelCharge") || "0", b.currency), damage: parseMoney(s(f, "damageCharge") || "0", b.currency), reason: s(f, "reason") }); break;
      case "extend": await service.extendRental(b, id, dateTime(s(f, "endAt"), b.timezone)); break;
      case "replace": await service.replaceVehicle(b, id, s(f, "vehicleId"), inspection(f, "out_"), inspection(f, "in_"), s(f, "reason")); break;
      case "close": await service.closeRental(b, id); break;
      default: return { error: "Unknown rental action." };
    }
  } catch (e) { return { error: service.publicError(e) }; }
  done(`/rentals/${encodeURIComponent(id)}`);
}
export async function moneyAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try {
    await service.recordMoney(b, { rentalId: s(f, "rentalId"), invoiceId: s(f, "invoiceId") || undefined, kind: s(f, "kind") as Parameters<typeof service.recordMoney>[1]["kind"], amount: parseMoney(s(f, "amount"), b.currency), method: s(f, "method"), reference: s(f, "reference"), reason: s(f, "reason"), requestKey: s(f, "requestKey") });
  } catch (e) { return { error: service.publicError(e) }; }
  done(`/rentals/${encodeURIComponent(s(f, "rentalId"))}`);
}
export async function creditAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try { await service.creditInvoice(b, s(f, "invoiceId"), parseMoney(s(f, "subtotal"), b.currency), s(f, "reason"), s(f, "requestKey")); } catch (e) { return { error: service.publicError(e) }; }
  done(`/rentals/${encodeURIComponent(s(f, "rentalId"))}`);
}
export async function maintenanceAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try { await service.createMaintenance(b, { vehicleId: s(f, "vehicleId"), title: s(f, "title"), supplier: s(f, "supplier"), startAt: dateTime(s(f, "startAt"), b.timezone), endAt: dateTime(s(f, "endAt"), b.timezone), cost: parseMoney(s(f, "cost") || "0", b.currency), notes: s(f, "notes") }); } catch (e) { return { error: service.publicError(e) }; }
  done("/maintenance");
}
export async function maintenanceStateAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness();
  try { await service.updateMaintenance(b, s(f, "id"), s(f, "state") as "IN_PROGRESS" | "COMPLETED" | "CANCELLED", parseMoney(s(f, "cost"), b.currency)); } catch (e) { return { error: service.publicError(e) }; }
  done("/maintenance");
}
export async function attachmentAction(_: ActionResult, f: FormData): Promise<ActionResult> {
  const b = await requireBusiness(); let written: string | undefined;
  const type = s(f, "entityType"), entityId = s(f, "entityId");
  try {
    const file = f.get("file");
    assert(file instanceof File && file.size > 0 && file.size <= 10 * 1024 * 1024, "Choose a JPG, PNG, WebP, or PDF up to 10 MB.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const signature = buffer.subarray(0, 12);
    const detected = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff ? "image/jpeg"
      : signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
      : signature.subarray(0, 4).toString() === "RIFF" && signature.subarray(8, 12).toString() === "WEBP" ? "image/webp"
      : signature.subarray(0, 5).toString() === "%PDF-" ? "application/pdf" : null;
    assert(detected, "Unsupported file content. Upload JPG, PNG, WebP, or PDF.");
    await service.owned(b, async (tx, business) => {
      const found = type === "vehicle" ? await tx.vehicle.findFirst({ where: { id: entityId, businessId: business.id } }) : type === "customer" ? await tx.customer.findFirst({ where: { id: entityId, businessId: business.id } }) : type === "rental" ? await tx.rental.findFirst({ where: { id: entityId, businessId: business.id } }) : null;
      assert(found, "Record not found.");
      const storageKey = randomUUID();
      const dir = privateDirectory();
      assert(!dir.startsWith(path.resolve("public") + path.sep) && dir !== path.resolve("public"), "Private storage must be outside public/.");
      await mkdir(dir, { recursive: true }); written = privateFile(storageKey);
      await writeFile(written, buffer, { flag: "wx" });
      const attachment = await tx.attachment.create({ data: { businessId: b.id, entityType: type, entityId, storageKey, filename: path.basename(file.name).slice(0, 200), contentType: detected, size: file.size } });
      await tx.audit.create({ data: { businessId: b.id, actorClerkId: b.ownerClerkId, action: "FILE_UPLOADED", entityType: type, entityId, details: { attachmentId: attachment.id } } });
    });
  } catch (e) { if (written) await unlink(written).catch(() => undefined); return { error: service.publicError(e) }; }
  done(`/${type === "vehicle" ? "vehicles" : type === "customer" ? "customers" : "rentals"}/${encodeURIComponent(entityId)}`);
}
