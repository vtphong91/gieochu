-- CreateEnum
CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'VOID');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "periodEndReminderStage" INTEGER;

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "amountVnd" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "checkoutPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payment_transactions" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "matchedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_code_key" ON "subscription_invoices"("code");

-- CreateIndex
CREATE INDEX "subscription_invoices_tenantId_idx" ON "subscription_invoices"("tenantId");

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_payment_transactions" ADD CONSTRAINT "platform_payment_transactions_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
