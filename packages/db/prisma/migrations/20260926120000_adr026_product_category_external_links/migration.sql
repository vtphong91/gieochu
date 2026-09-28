-- ADR-026: gắn danh mục tài liệu vào sản phẩm + link tài liệu ngoài trong product_files.

-- CreateEnum
CREATE TYPE "ProductFileSource" AS ENUM ('FILE', 'EXTERNAL_URL');

-- AlterTable
-- objectKey/mimeType/scanStatus thành nullable: dòng link ngoài không có object, không quét.
-- objectKey vẫn UNIQUE — Postgres coi các NULL là khác nhau nên nhiều dòng link không đụng nhau.
ALTER TABLE "product_files" ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "sourceKind" "ProductFileSource" NOT NULL DEFAULT 'FILE',
ALTER COLUMN "objectKey" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL,
ALTER COLUMN "scanStatus" DROP NOT NULL;

-- Ép hình dạng dòng theo sourceKind ở tầng DB (Prisma không biểu diễn được CHECK):
--  * FILE: bắt buộc objectKey/mimeType/scanStatus, không có externalUrl (giữ nguyên nghĩa cũ).
--  * EXTERNAL_URL: bắt buộc externalUrl; không objectKey, không scanStatus, sizeBytes = 0, không phải preview.
-- Dữ liệu hiện có đều là FILE với 3 cột NOT NULL cũ nên constraint hợp lệ ngay.
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_source_shape" CHECK (
  (
    "sourceKind" = 'FILE'
    AND "objectKey" IS NOT NULL
    AND "mimeType" IS NOT NULL
    AND "scanStatus" IS NOT NULL
    AND "externalUrl" IS NULL
  )
  OR (
    "sourceKind" = 'EXTERNAL_URL'
    AND "externalUrl" IS NOT NULL
    AND "objectKey" IS NULL
    AND "scanStatus" IS NULL
    AND "sizeBytes" = 0
    AND "isPreview" = false
  )
);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
