import { logger } from "@gieochu/core";
import { withSystemJob } from "@gieochu/db";

/**
 * ADR-033 mục 1 — cache `products.soldCount` = số `order_items` của đơn FULFILLED mà entitlement của dòng đó chưa
 * bị thu hồi (cùng công thức với backfill trong migration `20260929120000_adr033_product_sold_count`).
 *
 * - Tính lại toàn phần (COUNT) → idempotent, gọi thừa không sai; không cộng/trừ dồn.
 * - Chạy dưới `system_job`: đọc `orders/order_items/entitlements` của mọi tenant và UPDATE `products` (ADR-029 mục 0
 *   — chỉ tenant/system_job được ghi `products`). Trang public chỉ đọc cột cache, không bao giờ đọc `orders` (§7.9).
 * - Advisory lock theo sản phẩm tuần tự hoá các lần tính lại đồng thời để lần cuối luôn thấy mọi đơn đã commit.
 * - Raw SQL để không chạm `products.updatedAt`.
 * - Caller gọi SAU khi transaction đổi trạng thái đơn/entitlement đã commit. Lỗi chỉ log — nghiệp vụ chính đã lưu;
 *   lần thay đổi sau của cùng sản phẩm tự sửa cache.
 */
export async function recomputeProductSoldCounts(productIds: readonly string[]): Promise<void> {
  for (const productId of new Set(productIds)) {
    try {
      await withSystemJob(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`product-sold:${productId}`}))`;
        await tx.$executeRaw`
          UPDATE "products" SET "soldCount" = (
            SELECT COUNT(*)::int
            FROM "order_items" oi
            JOIN "orders" o ON o."id" = oi."orderId"
            WHERE oi."productId" = ${productId}
              AND o."status" = 'FULFILLED'
              AND NOT EXISTS (
                SELECT 1 FROM "entitlements" e
                WHERE e."orderItemId" = oi."id" AND e."revokedAt" IS NOT NULL
              )
          )
          WHERE "id" = ${productId}
        `;
      });
    } catch (error) {
      logger.error({ err: error, productId }, "product: tính lại số đã bán thất bại");
    }
  }
}
