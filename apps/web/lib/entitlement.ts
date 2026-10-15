import { notFound } from "@gieochu/core";
import { withTenant } from "@gieochu/db";
import { hideReviewsForRevokedItems, recomputeProductRatings } from "./review";
import { recomputeProductSoldCounts } from "./product-sold-count";

/** §"M9": "Tenant có thể cấp thêm lượt ... của một khách" — raises downloadLimit by `extra` (snapshot value, not the product's current limit). */
export async function grantExtraDownloads(tenantId: string, entitlementId: string, extra: number): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");

  await withTenant(tenantId, (tx) =>
    tx.entitlement.update({ where: { id: entitlementId }, data: { downloadLimit: { increment: extra } } }),
  );
}

/**
 * §"M9": "... hoặc thu hồi entitlement của một khách" — the customer's downloads stop working immediately (canDownloadEntitlement/RLS both gate on revokedAt).
 * ADR-029 mục 2: đánh giá gắn với dòng đơn của entitlement tự ẩn (HIDDEN, lý do REFUNDED), điểm tính lại sau commit.
 * ADR-033: `soldCount` của sản phẩm tính lại sau commit (dòng đơn có entitlement thu hồi không còn tính là đã bán).
 */
export async function revokeEntitlement(tenantId: string, entitlementId: string): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");

  const affectedProductIds = await withTenant(tenantId, async (tx) => {
    await tx.entitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date() } });
    return hideReviewsForRevokedItems(tx, tenantId, [entitlement.orderItemId]);
  });
  await recomputeProductRatings(affectedProductIds);
  await recomputeProductSoldCounts([entitlement.productId]);
}
