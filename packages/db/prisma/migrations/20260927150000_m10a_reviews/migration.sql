-- ADR-029 (M10a): bảng reviews + cột cache điểm trên products (số nguyên, không float — ADR-029 mục 3).

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewHiddenReason" AS ENUM ('SPAM', 'OFFENSIVE', 'IRRELEVANT', 'PERSONAL_INFO', 'REFUNDED', 'OTHER');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "hiddenReason" "ReviewHiddenReason",
    "hiddenAt" TIMESTAMP(3),
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_tenantId_createdAt_idx" ON "reviews"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_productId_status_createdAt_idx" ON "reviews"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");

-- CreateIndex
CREATE INDEX "reviews_orderItemId_idx" ON "reviews"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_productId_userId_key" ON "reviews"("productId", "userId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK ở tầng DB (ngoài zod ở server): sao 1–5, độ dài văn bản, và hình dạng trạng thái ẩn.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_body_length" CHECK ("body" IS NULL OR char_length("body") BETWEEN 1 AND 2000);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reply_length" CHECK ("reply" IS NULL OR char_length("reply") BETWEEN 1 AND 2000);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_display_name_length" CHECK (char_length("displayName") BETWEEN 1 AND 80);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_hidden_shape" CHECK (
  ("status" = 'VISIBLE' AND "hiddenReason" IS NULL AND "hiddenAt" IS NULL)
  OR ("status" = 'HIDDEN' AND "hiddenReason" IS NOT NULL AND "hiddenAt" IS NOT NULL)
);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reply_shape" CHECK (("reply" IS NULL) = ("repliedAt" IS NULL));
ALTER TABLE "products" ADD CONSTRAINT "products_rating_cache_nonnegative" CHECK ("ratingSum" >= 0 AND "ratingCount" >= 0);
