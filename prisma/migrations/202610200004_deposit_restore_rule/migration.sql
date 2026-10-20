ALTER TABLE "MoneyTransaction" DROP CONSTRAINT "transaction_invoice";
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "transaction_invoice" CHECK (
  (kind IN ('PAYMENT','PAYMENT_REFUND','DEPOSIT_APPLIED','DEPOSIT_RESTORED') AND "invoiceId" IS NOT NULL) OR
  (kind IN ('DEPOSIT_RECEIVED','DEPOSIT_REFUND') AND "invoiceId" IS NULL));
