-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VehicleState" AS ENUM ('ACTIVE', 'TURNAROUND', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RentalState" AS ENUM ('QUOTE', 'CONFIRMED', 'ACTIVE', 'RETURNED', 'CLOSED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "AllocationKind" AS ENUM ('RENTAL', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "InspectionKind" AS ENUM ('CHECKOUT', 'RETURN', 'REPLACEMENT_OUT', 'REPLACEMENT_IN');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('PAYMENT', 'PAYMENT_REFUND', 'DEPOSIT_RECEIVED', 'DEPOSIT_REFUND', 'DEPOSIT_APPLIED');

-- CreateEnum
CREATE TYPE "WorkState" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ownerClerkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "taxBps" INTEGER NOT NULL DEFAULT 0,
    "turnaroundMinutes" INTEGER NOT NULL DEFAULT 120,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "contractTerms" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "state" "VehicleState" NOT NULL DEFAULT 'ACTIVE',
    "odometer" INTEGER NOT NULL DEFAULT 0,
    "fuelPercent" INTEGER NOT NULL DEFAULT 100,
    "dailyRate" INTEGER NOT NULL,
    "weeklyRate" INTEGER NOT NULL,
    "monthlyRate" INTEGER NOT NULL,
    "depositRequired" INTEGER NOT NULL DEFAULT 0,
    "registrationExpiry" DATE,
    "insuranceExpiry" DATE,
    "serviceDueDate" DATE,
    "serviceDueKm" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" DATE NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "state" "RentalState" NOT NULL DEFAULT 'QUOTE',
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "rateUnit" "RateUnit" NOT NULL,
    "unitRate" INTEGER NOT NULL,
    "taxBps" INTEGER NOT NULL,
    "depositRequired" INTEGER NOT NULL,
    "includedKm" INTEGER NOT NULL DEFAULT 0,
    "extraKmRate" INTEGER NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "turnaroundMinutes" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "termsSnapshot" TEXT NOT NULL,
    "actualReturnAt" TIMESTAMPTZ(3),
    "nextBillingAt" TIMESTAMPTZ(3),
    "billedThrough" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "AllocationKind" NOT NULL,
    "rentalId" TEXT,
    "maintenanceId" TEXT,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "InspectionKind" NOT NULL,
    "odometer" INTEGER NOT NULL,
    "fuelPercent" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "actorClerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "InvoiceKind" NOT NULL DEFAULT 'INVOICE',
    "originalInvoiceId" TEXT,
    "billingKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "periodStart" TIMESTAMPTZ(3),
    "periodEnd" TIMESTAMPTZ(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "businessSnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "kind" "TransactionKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestKey" TEXT NOT NULL,
    "actorClerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "supplier" TEXT NOT NULL DEFAULT '',
    "state" "WorkState" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorClerkId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_ownerClerkId_key" ON "Business"("ownerClerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_businessId_plate_key" ON "Vehicle"("businessId", "plate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_businessId_vin_key" ON "Vehicle"("businessId", "vin");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_businessId_id_key" ON "Vehicle"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");

-- CreateIndex
CREATE INDEX "Rental_businessId_state_idx" ON "Rental"("businessId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Rental_businessId_id_key" ON "Rental"("businessId", "id");

-- CreateIndex
CREATE INDEX "Allocation_businessId_vehicleId_active_idx" ON "Allocation"("businessId", "vehicleId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_businessId_rentalId_kind_vehicleId_key" ON "Inspection"("businessId", "rentalId", "kind", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_number_key" ON "Invoice"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_billingKey_key" ON "Invoice"("businessId", "billingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_id_key" ON "Invoice"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyTransaction_businessId_requestKey_key" ON "MoneyTransaction"("businessId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Maintenance_businessId_id_key" ON "Maintenance"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_businessId_entityType_entityId_idx" ON "Attachment"("businessId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Audit_businessId_createdAt_idx" ON "Audit"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_businessId_rentalId_fkey" FOREIGN KEY ("businessId", "rentalId") REFERENCES "Rental"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_businessId_maintenanceId_fkey" FOREIGN KEY ("businessId", "maintenanceId") REFERENCES "Maintenance"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_businessId_rentalId_fkey" FOREIGN KEY ("businessId", "rentalId") REFERENCES "Rental"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_rentalId_fkey" FOREIGN KEY ("businessId", "rentalId") REFERENCES "Rental"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_businessId_rentalId_fkey" FOREIGN KEY ("businessId", "rentalId") REFERENCES "Rental"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_businessId_invoiceId_fkey" FOREIGN KEY ("businessId", "invoiceId") REFERENCES "Invoice"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
