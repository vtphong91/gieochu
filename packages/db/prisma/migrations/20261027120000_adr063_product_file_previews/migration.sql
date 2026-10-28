-- ADR-063 — Cache bản xem trước 20% nội dung thật của file tài liệu bán cho trang chi tiết công khai.
--
-- Migration EXPAND (ADR-034): chỉ THÊM bảng mới + 2 index + FK cascade. Không DROP, không RENAME, không
-- UPDATE dữ liệu. Code đang chạy không đọc bảng này → an toàn.
--
-- Lớp dữ liệu: L2 denormalized (`tenantId`, `productId` giống `product_files`) nhưng CHỈ server đọc qua
-- route guard — không bật RLS policy public cho bảng này. Access control: route handler kiểm tenant ACTIVE
-- + product PUBLISHED trước khi trả JSON.

-- CreateTable
CREATE TABLE "product_file_previews" (
    "productFileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ratio" INTEGER NOT NULL DEFAULT 20,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_file_previews_pkey" PRIMARY KEY ("productFileId")
);

-- CreateIndex
CREATE INDEX "product_file_previews_productId_idx" ON "product_file_previews"("productId");

-- CreateIndex
CREATE INDEX "product_file_previews_tenantId_idx" ON "product_file_previews"("tenantId");

-- AddForeignKey
ALTER TABLE "product_file_previews" ADD CONSTRAINT "product_file_previews_productFileId_fkey" FOREIGN KEY ("productFileId") REFERENCES "product_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
