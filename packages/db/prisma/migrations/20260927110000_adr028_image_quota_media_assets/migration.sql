-- ADR-028: hạn mức ảnh Cloudinary theo gói + bảng ghi nhận asset ảnh của tenant.
-- plans."imageStorageMb" default 100 (mức FREE) cho gói tạo mới / gói ngoài 4 mã chuẩn. 4 gói chuẩn được đặt
-- đúng số chủ dự án duyệt (FREE 100MB, CREATOR 1GB, PRO 2GB, BUSINESS 5GB) — chỉ là dữ liệu khởi tạo, System
-- Admin sửa được ở /admin/plans (logic nghiệp vụ không đọc plan.code, ADR-021).

-- CreateEnum
CREATE TYPE "TenantMediaUsage" AS ENUM ('CONTENT', 'PRODUCT_COVER', 'STOREFRONT');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "imageStorageMb" INTEGER NOT NULL DEFAULT 100;

UPDATE "plans" SET "imageStorageMb" = 1024 WHERE "code" = 'CREATOR';
UPDATE "plans" SET "imageStorageMb" = 2048 WHERE "code" = 'PRO';
UPDATE "plans" SET "imageStorageMb" = 5120 WHERE "code" = 'BUSINESS';

-- CreateTable
CREATE TABLE "tenant_media_assets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "usage" "TenantMediaUsage" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_media_assets_publicId_key" ON "tenant_media_assets"("publicId");

-- CreateIndex
CREATE INDEX "tenant_media_assets_tenantId_createdAt_idx" ON "tenant_media_assets"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "tenant_media_assets" ADD CONSTRAINT "tenant_media_assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
