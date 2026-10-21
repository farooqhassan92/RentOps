import { z } from "zod";
export const text = (max = 200) => z.string().trim().max(max);
export const required = (max = 200) => text(max).min(1, "This field is required.");
export const id = required(100);
export const integer = (max = 10_000_000) => z.coerce.number().int().min(0).max(max);
export const businessSchema = z.object({
  name: required(), branchName: required(), country: required(100),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).refine(s => Intl.supportedValuesOf("currency").includes(s), "Select a supported currency."),
  timezone: required(100).refine(s => { try { new Intl.DateTimeFormat("en", { timeZone: s }); return true; } catch { return false; } }, "Enter a valid IANA timezone."),
  address: text(1000), email: z.union([z.literal(""), z.email()]), phone: text(100), taxId: text(100),
  taxBps: integer(10000), turnaroundMinutes: integer(1440), invoicePrefix: z.string().trim().regex(/^[A-Z0-9-]{1,12}$/), contractTerms: text(15000),
});
export const vehicleSchema = z.object({
  plate: required(30).transform(s => s.toUpperCase()), vin: text(40).transform(s => s.toUpperCase() || null),
  make: required(80), model: required(80), year: z.coerce.number().int().min(1950).max(new Date().getUTCFullYear() + 2),
  category: required(80), color: text(80), odometer: integer(), fuelPercent: integer(100),
  dailyRate: integer(2_000_000_000).min(1), weeklyRate: integer(2_000_000_000).min(1), monthlyRate: integer(2_000_000_000).min(1), depositRequired: integer(2_000_000_000),
  registrationExpiry: z.date().nullable(), insuranceExpiry: z.date().nullable(), serviceDueDate: z.date().nullable(), serviceDueKm: integer().nullable(), notes: text(3000),
});
export const customerSchema = z.object({ name: required(), company: text(), email: z.union([z.literal(""), z.email()]), phone: required(100), address: text(1000), licenseNumber: required(100), licenseExpiry: z.date(), notes: text(3000) });
export const rentalSchema = z.object({ vehicleId: id, customerId: id, startAt: z.date(), endAt: z.date(), rateUnit: z.enum(["DAY", "WEEK", "MONTH"]), unitRate: integer(2_000_000_000).min(1), depositRequired: integer(2_000_000_000), includedKm: integer(), extraKmRate: integer(2_000_000_000), extras: integer(2_000_000_000), discount: integer(2_000_000_000), notes: text(3000) });
export const inspectionSchema = z.object({ odometer: integer(), fuelPercent: integer(100), condition: required(3000), exterior: z.boolean().refine(Boolean, "Complete the exterior check."), interior: z.boolean().refine(Boolean, "Complete the interior check."), equipment: z.boolean().refine(Boolean, "Complete the equipment check.") });
