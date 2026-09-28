-- CreateEnum
CREATE TYPE "StorefrontMessageStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "storefrontSections" JSONB,
ADD COLUMN     "storefrontSectionsDraft" JSONB;

-- CreateTable
CREATE TABLE "storefront_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "StorefrontMessageStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storefront_messages_tenantId_createdAt_idx" ON "storefront_messages"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "storefront_messages_ipHash_createdAt_idx" ON "storefront_messages"("ipHash", "createdAt");

-- AddForeignKey
ALTER TABLE "storefront_messages" ADD CONSTRAINT "storefront_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

