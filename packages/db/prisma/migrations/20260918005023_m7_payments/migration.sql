-- CreateEnum
CREATE TYPE "PaymentProviderId" AS ENUM ('MANUAL_QR', 'SEPAY', 'MOMO');

-- CreateEnum
CREATE TYPE "WebhookScope" AS ENUM ('PLATFORM', 'TENANT');

-- CreateTable
CREATE TABLE "tenant_payment_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicConfig" JSONB NOT NULL,
    "encryptedSecrets" TEXT NOT NULL,
    "webhookSecretHash" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_payment_configs" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publicConfig" JSONB NOT NULL,
    "encryptedSecrets" TEXT NOT NULL,
    "webhookSecretHash" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "scope" "WebhookScope" NOT NULL,
    "provider" "PaymentProviderId" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "tenantId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_bins" (
    "bin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,

    CONSTRAINT "bank_bins_pkey" PRIMARY KEY ("bin")
);

-- CreateIndex
CREATE INDEX "tenant_payment_configs_tenantId_idx" ON "tenant_payment_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_payment_configs_tenantId_provider_key" ON "tenant_payment_configs"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "platform_payment_configs_provider_key" ON "platform_payment_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_scope_provider_providerEventId_key" ON "webhook_events"("scope", "provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "tenant_payment_configs" ADD CONSTRAINT "tenant_payment_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
