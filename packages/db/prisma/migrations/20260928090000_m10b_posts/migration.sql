-- ADR-029 mục 5 + 6 (M10b): bảng posts (bài viết tối giản của tenant) + usage ảnh POST cho tenant_media_assets.

-- AlterEnum (không dùng giá trị mới trong cùng migration → ADD VALUE hợp lệ trong transaction, PG >= 12)
ALTER TYPE "TenantMediaUsage" ADD VALUE 'POST';

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "productId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "hiddenReason" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posts_tenantId_status_publishedAt_idx" ON "posts"("tenantId", "status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "posts_productId_idx" ON "posts"("productId");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tối đa 1 bài ghim / tenant (ADR-029 mục 5). Partial unique index — Prisma schema không biểu diễn được, chỉ khai
-- báo ở đây (ghi chú trên model Post). Ghim bài mới bỏ ghim bài cũ trong cùng transaction (apps/web/lib/post.ts).
CREATE UNIQUE INDEX "posts_tenantId_pinned_key" ON "posts"("tenantId") WHERE "isPinned";

-- CHECK ở tầng DB (ngoài validate ở server): độ dài, hình dạng trạng thái.
ALTER TABLE "posts" ADD CONSTRAINT "posts_title_length" CHECK ("title" IS NULL OR char_length("title") BETWEEN 1 AND 200);
ALTER TABLE "posts" ADD CONSTRAINT "posts_excerpt_length" CHECK (char_length("excerpt") <= 300);
ALTER TABLE "posts" ADD CONSTRAINT "posts_body_length" CHECK (char_length("body") BETWEEN 1 AND 100000);
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_reason_length" CHECK ("hiddenReason" IS NULL OR char_length("hiddenReason") BETWEEN 1 AND 500);
ALTER TABLE "posts" ADD CONSTRAINT "posts_hidden_shape" CHECK ("hiddenReason" IS NULL OR "status" = 'HIDDEN');
ALTER TABLE "posts" ADD CONSTRAINT "posts_published_at_shape" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
