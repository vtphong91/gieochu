-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('TEMPLATE', 'SLIDE', 'EBOOK', 'EXAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductFileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "coverImageKey" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "downloadLimit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "priceVnd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "salePriceVnd" INTEGER,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "product_files" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "scanStatus" "ProductFileScanStatus" NOT NULL DEFAULT 'PENDING',
    "isPreview" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_files_objectKey_key" ON "product_files"("objectKey");

-- CreateIndex
CREATE INDEX "product_files_productId_idx" ON "product_files"("productId");

-- CreateIndex
CREATE INDEX "product_files_tenantId_idx" ON "product_files"("tenantId");

-- AddForeignKey
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
