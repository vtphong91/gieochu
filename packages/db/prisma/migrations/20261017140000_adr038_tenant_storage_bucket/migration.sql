-- ADR-038: Mở rộng lưu trữ đa nền tảng MinIO / R2 và Dedicated Bucket cho Tenant (Expand only)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storageBucket" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;

ALTER TABLE "product_files" ADD COLUMN IF NOT EXISTS "storageBucket" TEXT;
ALTER TABLE "product_files" ADD COLUMN IF NOT EXISTS "storageProvider" TEXT;
