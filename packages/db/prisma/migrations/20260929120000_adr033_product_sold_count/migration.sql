-- ADR-033 mục 1: cột cache "số đã bán" trên products (số nguyên, không âm).
-- soldCount = số order_items thuộc đơn FULFILLED mà entitlement của dòng đó CHƯA bị thu hồi (đơn REFUNDED không
-- còn là FULFILLED; thu hồi entitlement lẻ loại đúng dòng đó). Cập nhật lúc chạy bằng `recomputeProductSoldCounts`
-- (apps/web/lib/product-sold-count.ts, scope system_job) — cùng công thức với backfill dưới đây.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "soldCount" INTEGER NOT NULL DEFAULT 0;

-- Prisma không biểu diễn được CHECK.
ALTER TABLE "products" ADD CONSTRAINT "products_sold_count_nonnegative" CHECK ("soldCount" >= 0);

-- Backfill từ dữ liệu hiện có (migration chạy bằng role owner — BYPASSRLS, thấy mọi tenant). Không chạm "updatedAt".
UPDATE "products" p SET "soldCount" = s."cnt"
FROM (
  SELECT oi."productId", COUNT(*)::int AS "cnt"
  FROM "order_items" oi
  JOIN "orders" o ON o."id" = oi."orderId"
  WHERE o."status" = 'FULFILLED'
    AND NOT EXISTS (
      SELECT 1 FROM "entitlements" e
      WHERE e."orderItemId" = oi."id" AND e."revokedAt" IS NOT NULL
    )
  GROUP BY oi."productId"
) s
WHERE p."id" = s."productId";
