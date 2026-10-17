/**
 * ADR-039 — quyền lợi người mua khi tài liệu bị admin lưu trữ do vi phạm. Hằng/nhãn/hàm thuần, không phụ thuộc DB —
 * client component (thư viện khách, Studio đơn hàng) import được qua `@gieochu/core/entitlement-remedy`.
 * Ghi/đọc DB ở apps/web/lib/entitlement-remedy.ts.
 */

/** Khớp enum Postgres `EntitlementRemedyStatus`. */
export const ENTITLEMENT_REMEDY_STATUSES = ["NONE", "PENDING_CHOICE", "FINAL_DOWNLOAD", "REFUND_REQUESTED", "REFUNDED"] as const;
export type EntitlementRemedyStatusValue = (typeof ENTITLEMENT_REMEDY_STATUSES)[number];

/** ADR-039 mục 3: tenant được đề nghị xử lý yêu cầu hoàn tiền trong 7 ngày (tính từ lúc khách chọn). */
export const REMEDY_REFUND_SLA_DAYS = 7;

/** Mã lỗi nghiệp vụ (AppError.code). */
export const ENTITLEMENT_REMEDY_ERROR_CODES = {
  /** Tải bị chặn vì khách chưa chọn (tải lần cuối / hoàn tiền). */
  CHOICE_REQUIRED: "REMEDY_CHOICE_REQUIRED",
  /** Tải bị chặn vĩnh viễn vì khách đã yêu cầu hoàn tiền (hoặc đã được hoàn). */
  DOWNLOAD_BLOCKED_REFUND: "DOWNLOAD_BLOCKED_REFUND",
  /** Entitlement không ở trạng thái chờ chọn (đã chọn rồi / không bị ảnh hưởng / đã thu hồi). */
  NOT_PENDING: "REMEDY_NOT_PENDING",
  /** Đơn 0đ — chỉ có lựa chọn tải lần cuối. */
  REFUND_NOT_AVAILABLE: "REMEDY_REFUND_NOT_AVAILABLE",
  /** Tenant cấp thêm lượt tải cho entitlement đang có remedy. */
  LIMIT_LOCKED: "REMEDY_DOWNLOAD_LIMIT_LOCKED",
} as const;

export const ENTITLEMENT_REMEDY_STATUS_LABELS: Record<EntitlementRemedyStatusValue, string> = {
  NONE: "Bình thường",
  PENDING_CHOICE: "Chờ khách chọn",
  FINAL_DOWNLOAD: "Khách chọn tải lần cuối",
  REFUND_REQUESTED: "Yêu cầu hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};

export function isEntitlementRemedyStatus(value: unknown): value is EntitlementRemedyStatusValue {
  return typeof value === "string" && (ENTITLEMENT_REMEDY_STATUSES as readonly string[]).includes(value);
}

export type RemedyDownloadBlock = "CHOICE_REQUIRED" | "REFUND" | null;

/** Trạng thái remedy có chặn tải không. NONE/FINAL_DOWNLOAD → tải theo `downloadLimit` như thường. */
export function remedyDownloadBlock(status: EntitlementRemedyStatusValue): RemedyDownloadBlock {
  if (status === "PENDING_CHOICE") return "CHOICE_REQUIRED";
  if (status === "REFUND_REQUESTED" || status === "REFUNDED") return "REFUND";
  return null;
}
