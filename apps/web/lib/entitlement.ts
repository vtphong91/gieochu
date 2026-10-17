import { AppError, ENTITLEMENT_REMEDY_ERROR_CODES, notFound } from "@gieochu/core";
import { withTenant } from "@gieochu/db";
import { hideReviewsForRevokedItems, recomputeProductRatings } from "./review";
import { recomputeProductSoldCounts } from "./product-sold-count";
import { audit } from "./audit";

/** §"M9": "Tenant có thể cấp thêm lượt ... của một khách" — raises downloadLimit by `extra` (snapshot value, not the product's current limit). */
export async function grantExtraDownloads(tenantId: string, entitlementId: string, extra: number, actorId: string | null = null): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");
  // ADR-039: tài liệu bị gỡ do vi phạm — lượt tải do lựa chọn của khách quyết định (tải lần cuối / chặn vĩnh viễn);
  // trigger entitlements_guard_remedy cũng chặn ở DB.
  if (entitlement.remedyStatus !== "NONE") {
    throw new AppError({
      code: ENTITLEMENT_REMEDY_ERROR_CODES.LIMIT_LOCKED,
      message: "Tài liệu đã bị gỡ do vi phạm nên không thể cấp thêm lượt tải cho khách này.",
      httpStatus: 409,
    });
  }

  await withTenant(tenantId, (tx) =>
    tx.entitlement.update({ where: { id: entitlementId }, data: { downloadLimit: { increment: extra } } }),
  );
  // §7.9: chỉ id (entitlement/sản phẩm/dòng đơn) — không ghi userId/email của khách.
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "ENTITLEMENT_EXTRA_GRANTED",
    targetType: "Entitlement",
    targetId: entitlementId,
    metadata: { productId: entitlement.productId, orderItemId: entitlement.orderItemId, extra },
  });
}

/**
 * §"M9": "... hoặc thu hồi entitlement của một khách" — the customer's downloads stop working immediately (canDownloadEntitlement/RLS both gate on revokedAt).
 * ADR-029 mục 2: đánh giá gắn với dòng đơn của entitlement tự ẩn (HIDDEN, lý do REFUNDED), điểm tính lại sau commit.
 * ADR-033: `soldCount` của sản phẩm tính lại sau commit (dòng đơn có entitlement thu hồi không còn tính là đã bán).
 */
export async function revokeEntitlement(tenantId: string, entitlementId: string, actorId: string | null = null): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");

  const affectedProductIds = await withTenant(tenantId, async (tx) => {
    await tx.entitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date() } });
    return hideReviewsForRevokedItems(tx, tenantId, [entitlement.orderItemId]);
  });
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "ENTITLEMENT_REVOKED",
    targetType: "Entitlement",
    targetId: entitlementId,
    metadata: { productId: entitlement.productId, orderItemId: entitlement.orderItemId, alreadyRevoked: entitlement.revokedAt !== null },
  });
  await recomputeProductRatings(affectedProductIds);
  await recomputeProductSoldCounts([entitlement.productId]);
}
