CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Allocation" ADD CONSTRAINT "allocation_no_overlap"
EXCLUDE USING gist ("businessId" WITH =, "vehicleId" WITH =, tstzrange("startAt", "endAt", '[)') WITH &&) WHERE (active);
ALTER TABLE "Allocation" ADD CONSTRAINT "allocation_valid_period" CHECK ("endAt" > "startAt");
ALTER TABLE "Allocation" ADD CONSTRAINT "allocation_parent" CHECK (
  (kind = 'RENTAL' AND "rentalId" IS NOT NULL AND "maintenanceId" IS NULL) OR
  (kind = 'MAINTENANCE' AND "maintenanceId" IS NOT NULL AND "rentalId" IS NULL));
ALTER TABLE "Rental" ADD CONSTRAINT "rental_valid_period" CHECK ("endAt" > "startAt");
ALTER TABLE "Rental" ADD CONSTRAINT "rental_positive_amounts" CHECK ("unitRate" > 0 AND "depositRequired" >= 0 AND "extras" >= 0 AND "discount" >= 0 AND "includedKm" >= 0 AND "extraKmRate" >= 0 AND "taxBps" BETWEEN 0 AND 10000);
ALTER TABLE "Vehicle" ADD CONSTRAINT "vehicle_valid_amounts" CHECK ("dailyRate" > 0 AND "weeklyRate" > 0 AND "monthlyRate" > 0 AND "depositRequired" >= 0 AND "odometer" >= 0 AND "fuelPercent" BETWEEN 0 AND 100);
ALTER TABLE "Inspection" ADD CONSTRAINT "inspection_valid_values" CHECK ("odometer" >= 0 AND "fuelPercent" BETWEEN 0 AND 100);
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_valid_amounts" CHECK (subtotal >= 0 AND tax >= 0 AND total = subtotal + tax);
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_credit_parent" CHECK ((kind = 'INVOICE' AND "originalInvoiceId" IS NULL) OR (kind = 'CREDIT_NOTE' AND "originalInvoiceId" IS NOT NULL));
ALTER TABLE "Invoice" ADD CONSTRAINT "invoice_credit_tenant" FOREIGN KEY ("businessId", "originalInvoiceId") REFERENCES "Invoice"("businessId", id) ON DELETE RESTRICT;
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "transaction_positive" CHECK (amount > 0);
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "transaction_invoice" CHECK (
  (kind IN ('PAYMENT','PAYMENT_REFUND','DEPOSIT_APPLIED') AND "invoiceId" IS NOT NULL) OR
  (kind IN ('DEPOSIT_RECEIVED','DEPOSIT_REFUND') AND "invoiceId" IS NULL));
ALTER TABLE "Business" ADD CONSTRAINT "business_valid_defaults" CHECK ("taxBps" BETWEEN 0 AND 10000 AND "turnaroundMinutes" BETWEEN 0 AND 1440 AND "nextInvoiceNumber" > 0);
-- Issued financial records are append-only even if an application bug attempts an update.
CREATE FUNCTION fleetora_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Issued financial records and audit events are immutable'; END; $$;
CREATE TRIGGER immutable_invoice BEFORE UPDATE OR DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION fleetora_immutable();
CREATE TRIGGER immutable_transaction BEFORE UPDATE OR DELETE ON "MoneyTransaction" FOR EACH ROW EXECUTE FUNCTION fleetora_immutable();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION fleetora_immutable();
