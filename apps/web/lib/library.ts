import { effectiveOrderStatus, normalizeExternalDocumentUrl, type EntitlementRemedyStatusValue } from "@gieochu/core";
import { withCustomer, type ReviewStatus } from "@gieochu/db";
import { getMyReviewsByProduct } from "./review";

/**
 * Một mục tải trong Thư viện. ADR-026: `kind = EXTERNAL_URL` là link tài liệu ngoài — `fileName` là nhãn,
 * `sizeBytes = 0`; URL thật KHÔNG có ở đây, chỉ lộ ra khi khách mở qua `POST /api/downloads` → token (tính
 * lượt + ghi DownloadEvent như file).
 */
export interface LibraryFile {
  id: string;
  kind: "FILE" | "EXTERNAL_URL";
  fileName: string;
  sizeBytes: number;
}

export interface LibraryEntitlement {
  entitlementId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  downloadsUsed: number;
  downloadLimit: number;
  revoked: boolean;
  files: LibraryFile[];
  /** ADR-029: được viết/sửa đánh giá (entitlement chưa thu hồi — entitlement chỉ sinh khi đơn FULFILLED). */
  canReview: boolean;
  /** Đánh giá hiện có của khách cho sản phẩm (theo sản phẩm, không theo từng lần mua); null = chưa đánh giá. */
  review: { id: string; rating: number; status: ReviewStatus } | null;
  /**
   * ADR-039 — tài liệu bị gỡ do vi phạm. NONE = bình thường. PENDING_CHOICE = tải bị chặn, hiện 2 lựa chọn (chỉ lựa chọn
   * tải lần cuối khi `refundAvailable = false`). FINAL_DOWNLOAD = còn đúng lượt theo `downloadLimit` — hiện cảnh báo
   * trước khi tải. REFUND_REQUESTED/REFUNDED = chặn tải vĩnh viễn. Khi `revoked = true` thì trạng thái thu hồi ưu tiên.
   */
  remedyStatus: EntitlementRemedyStatusValue;
  /** Đơn > 0đ → được chọn "yêu cầu hoàn tiền". Server kiểm lại (không tin giá trị này). */
  refundAvailable: boolean;
  /** Thời điểm khách chọn (null khi chưa chọn / không bị ảnh hưởng). */
  remedyChosenAt: Date | null;
  /** Thời điểm tenant xác nhận đã hoàn tiền (chỉ có khi REFUNDED). */
  remedyResolvedAt: Date | null;
  /**
   * Số lượt "tải lần cuối" sẽ được cấp nếu khách chọn lựa chọn A = số tệp khả dụng hiện tại (tối thiểu 1) — cùng cách
   * tính với `chooseFinalDownload`. Chỉ để hiển thị.
   */
  finalDownloadFileCount: number;
  /** Mã đơn gốc (hiện cạnh yêu cầu hoàn tiền). */
  orderCode: string;
}

export interface LibraryTenantGroup {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  entitlements: LibraryEntitlement[];
}

/** §"M9": "Thư viện gom mọi entitlement của user từ tất cả tenant, nhóm theo tenant". */
export async function listLibraryEntitlements(userId: string): Promise<LibraryTenantGroup[]> {
  const entitlements = await withCustomer(userId, (tx) =>
    tx.entitlement.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        orderItem: { select: { order: { select: { code: true, totalVnd: true } } } },
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            files: {
              where: {
                isPreview: false,
                removedAt: null,
                OR: [{ sourceKind: "FILE", scanStatus: "CLEAN" }, { sourceKind: "EXTERNAL_URL" }],
              },
              // externalUrl chỉ đọc để lọc link không còn qua allowlist — không trả ra ngoài hàm này.
              select: { id: true, sourceKind: true, fileName: true, sizeBytes: true, externalUrl: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  const reviews = await getMyReviewsByProduct(
    userId,
    entitlements.map((e) => e.productId),
  );

  const groups = new Map<string, LibraryTenantGroup>();
  for (const entitlement of entitlements) {
    let group = groups.get(entitlement.tenantId);
    if (!group) {
      group = { tenantId: entitlement.tenantId, tenantName: entitlement.tenant.name, tenantSlug: entitlement.tenant.slug, entitlements: [] };
      groups.set(entitlement.tenantId, group);
    }
    const files = entitlement.product.files
      .filter((f) => f.sourceKind === "FILE" || (f.externalUrl != null && normalizeExternalDocumentUrl(f.externalUrl) !== null))
      .map((f) => ({ id: f.id, kind: f.sourceKind, fileName: f.fileName, sizeBytes: f.sizeBytes }));
    group.entitlements.push({
      entitlementId: entitlement.id,
      productId: entitlement.productId,
      productTitle: entitlement.product.title,
      productSlug: entitlement.product.slug,
      downloadsUsed: entitlement.downloadsUsed,
      downloadLimit: entitlement.downloadLimit,
      revoked: entitlement.revokedAt != null,
      files,
      canReview: entitlement.revokedAt == null,
      review: reviews.get(entitlement.productId) ?? null,
      remedyStatus: entitlement.remedyStatus,
      refundAvailable: entitlement.orderItem.order.totalVnd > 0,
      remedyChosenAt: entitlement.remedyChosenAt,
      remedyResolvedAt: entitlement.remedyResolvedAt,
      finalDownloadFileCount: Math.max(1, files.length),
      orderCode: entitlement.orderItem.order.code,
    });
  }
  return [...groups.values()];
}

export interface LibraryOrder {
  id: string;
  code: string;
  tenantName: string;
  tenantSlug: string;
  productTitle: string;
  totalVnd: number;
  status: string;
  createdAt: Date;
}

/** §"M9": "Lịch sử đơn hàng: mã đơn, tenant, sản phẩm, số tiền, trạng thái, thời gian". */
export async function listCustomerOrders(userId: string): Promise<LibraryOrder[]> {
  const orders = await withCustomer(userId, (tx) =>
    tx.order.findMany({
      where: { customerId: userId },
      include: { tenant: { select: { name: true, slug: true } }, items: { select: { titleSnapshot: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );

  const now = new Date();
  return orders.map((order) => ({
    id: order.id,
    code: order.code,
    tenantName: order.tenant.name,
    tenantSlug: order.tenant.slug,
    productTitle: order.items.map((item) => item.titleSnapshot).join(", "),
    totalVnd: order.totalVnd,
    // ADR-036: overdue PENDING shows as EXPIRED (no checkout link) even before the daily sweep.
    status: effectiveOrderStatus(order.status, order.expiresAt, now),
    createdAt: order.createdAt,
  }));
}
