/**
 * ADR-037 (M12a) — hằng và hàm thuần cho audit log. Ghi/đọc DB nằm ở apps/web/lib/audit.ts và
 * apps/web/lib/audit-query.ts; file này không phụ thuộc Prisma để client component cũng import được nhãn.
 */

/** Khớp enum Postgres `AuditScope` (packages/db/prisma/schema.prisma). */
export const AUDIT_SCOPES = ["SYSTEM", "TENANT", "CUSTOMER"] as const;
export type AuditScopeValue = (typeof AUDIT_SCOPES)[number];

/**
 * Danh sách action. `action` lưu dạng chuỗi (không enum DB) — thêm action chỉ cần thêm vào đây.
 * 21 action đầu theo đặc tả §"M12"; phần sau là action bổ sung (trước đây chỉ ghi `logger` tạm).
 */
export const AUDIT_ACTIONS = [
  // §"M12" — tối thiểu
  "AUTH_LOGIN",
  "AUTH_LOGIN_FAILED",
  "AUTH_REFRESH_REUSE",
  "USER_LOCKED",
  "USER_UNLOCKED",
  "TENANT_CREATED",
  "TENANT_LOCKED",
  "TENANT_SLUG_CHANGED",
  "PLAN_UPDATED",
  "SUBSCRIPTION_PAID",
  "PAYMENT_CONFIG_UPDATED",
  "PRODUCT_PUBLISHED",
  "PRODUCT_ARCHIVED",
  "PRODUCT_DELETED",
  "ORDER_MANUALLY_CONFIRMED",
  "ORDER_REFUNDED",
  "ENTITLEMENT_REVOKED",
  "SHARE_LINK_CREATED",
  "SHARE_LINK_REVOKED",
  "REVIEW_HIDDEN",
  "REPORT_RESOLVED",
  "ADMIN_VIEWED_TENANT",
  // Bổ sung
  "TENANT_UNLOCKED",
  "PLAN_CREATED",
  "COUPON_OVERUSED",
  "REVIEW_RESTORED",
  "ENTITLEMENT_EXTRA_GRANTED",
  "SYSTEM_SETTINGS_UPDATED",
  // ADR-038 (M12c)
  "REPORT_SUBMITTED",
  "CONTENT_MODERATION_LOCKED",
  "CONTENT_MODERATION_UNLOCKED",
  // ADR-039
  "REMEDY_FINAL_DOWNLOAD_CHOSEN",
  "REMEDY_REFUND_REQUESTED",
  // ADR-041 mục C (Hồ sơ)
  "AUTH_PASSWORD_CHANGED",
  "AUTH_EMAIL_CHANGE_REQUESTED",
  "AUTH_EMAIL_CHANGED",
  // ADR-041 A/B
  "PRICING_CMS_UPDATED",
  "SUBSCRIPTION_REFUND_REQUESTED",
  "SUBSCRIPTION_REFUNDED",
  "SUBSCRIPTION_REFUND_REJECTED",
  "SUBSCRIPTION_REFUND_PAYOUT_VIEWED",
  // ADR-047 (ghi chú nội bộ trên đơn — metadata chỉ id, không nội dung)
  "ORDER_NOTE_ADDED",
  "ORDER_NOTE_DELETED",
  // ADR-048 (ghi chú khách tại gian hàng — metadata chỉ customerUserId, không nội dung)
  "CUSTOMER_NOTE_UPDATED",
  // ADR-050 (metadata chỉ loại thao tác)
  "HOME_CMS_UPDATED",
  "MENU_CMS_UPDATED",
  "LEGAL_VERSION_CREATED",
  "LEGAL_VERSION_UPDATED",
  "LEGAL_REVIEW_STATUS_CHANGED",
  "LEGAL_VERSION_PUBLISHED",
  "LEGAL_VERSION_ARCHIVED",
  // ADR-054 (metadata chỉ khoá văn bản + cờ trường có giá trị, không nội dung)
  "LEGAL_DOCUMENT_META_UPDATED",
  // ADR-061/062 — luồng mua của khách (metadata chỉ id/phương thức/cờ, không thông tin khách)
  "ORDER_PAYMENT_EMAIL_SENT",
  "ORDER_CUSTOMER_DECLARED_PAID",
  "ORDER_CUSTOMER_DECLARED_PAID_UNDONE",
  "ORDER_CANCELED_BY_CUSTOMER",
  // ADR-061 Q1 — khách vãng lai (metadata không chứa email/họ tên)
  "AUTH_GUEST_ACCOUNT_CREATED",
  "AUTH_GUEST_ACTIVATED",
  // ADR-067 — đổi trạng thái hoá đơn gói (System Admin; metadata: trạng thái cũ/mới, ghi chú không bắt buộc)
  "SUBSCRIPTION_INVOICE_VOIDED",
  "SUBSCRIPTION_INVOICE_REOPENED",
  // ADR-068 — người bán "Đổi trạng thái…" đơn (metadata chỉ trạng thái cũ/mới, không văn bản tự do — §7.9)
  "ORDER_CANCELED_BY_SELLER",
  "ORDER_REOPENED_BY_SELLER",
  // ADR-071 (2A) — mốc tạo hoá đơn gói (metadata: code, planId, provider, amountVnd)
  "SUBSCRIPTION_INVOICE_CREATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AUDIT_ACTION_SET: ReadonlySet<string> = new Set(AUDIT_ACTIONS);

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && AUDIT_ACTION_SET.has(value);
}

export function isAuditScope(value: unknown): value is AuditScopeValue {
  return typeof value === "string" && (AUDIT_SCOPES as readonly string[]).includes(value);
}

/** Nhãn tiếng Việt cho trang xem nhật ký (admin + studio). */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  AUTH_LOGIN: "Đăng nhập",
  AUTH_LOGIN_FAILED: "Đăng nhập thất bại",
  AUTH_REFRESH_REUSE: "Phát hiện dùng lại phiên đăng nhập",
  USER_LOCKED: "Khoá người dùng",
  USER_UNLOCKED: "Mở khoá người dùng",
  TENANT_CREATED: "Tạo gian hàng",
  TENANT_LOCKED: "Khoá gian hàng",
  TENANT_SLUG_CHANGED: "Đổi đường dẫn gian hàng",
  PLAN_UPDATED: "Cập nhật gói dịch vụ",
  SUBSCRIPTION_PAID: "Thanh toán gói dịch vụ",
  PAYMENT_CONFIG_UPDATED: "Cập nhật cấu hình thanh toán",
  PRODUCT_PUBLISHED: "Xuất bản tài liệu",
  PRODUCT_ARCHIVED: "Lưu trữ tài liệu",
  PRODUCT_DELETED: "Xoá tài liệu",
  ORDER_MANUALLY_CONFIRMED: "Xác nhận thanh toán thủ công",
  ORDER_REFUNDED: "Hoàn tiền đơn hàng",
  ENTITLEMENT_REVOKED: "Thu hồi quyền tải",
  SHARE_LINK_CREATED: "Tạo link chia sẻ",
  SHARE_LINK_REVOKED: "Thu hồi link chia sẻ",
  REVIEW_HIDDEN: "Ẩn đánh giá",
  REPORT_RESOLVED: "Xử lý báo cáo vi phạm",
  ADMIN_VIEWED_TENANT: "Quản trị xem gian hàng",
  TENANT_UNLOCKED: "Mở khoá gian hàng",
  PLAN_CREATED: "Tạo gói dịch vụ",
  COUPON_OVERUSED: "Mã giảm giá vượt lượt dùng",
  REVIEW_RESTORED: "Khôi phục đánh giá",
  ENTITLEMENT_EXTRA_GRANTED: "Cấp thêm lượt tải",
  SYSTEM_SETTINGS_UPDATED: "Cập nhật cấu hình hệ thống",
  REPORT_SUBMITTED: "Gửi báo cáo vi phạm",
  CONTENT_MODERATION_LOCKED: "Khoá kiểm duyệt nội dung",
  CONTENT_MODERATION_UNLOCKED: "Gỡ khoá kiểm duyệt nội dung",
  REMEDY_FINAL_DOWNLOAD_CHOSEN: "Khách chọn tải lần cuối (tài liệu bị gỡ)",
  REMEDY_REFUND_REQUESTED: "Khách yêu cầu hoàn tiền (tài liệu bị gỡ)",
  AUTH_PASSWORD_CHANGED: "Đổi mật khẩu",
  AUTH_EMAIL_CHANGE_REQUESTED: "Yêu cầu đổi email đăng nhập",
  AUTH_EMAIL_CHANGED: "Đổi email đăng nhập",
  PRICING_CMS_UPDATED: "Cập nhật trang Bảng giá",
  SUBSCRIPTION_REFUND_REQUESTED: "Yêu cầu hoàn tiền gói dịch vụ",
  SUBSCRIPTION_REFUNDED: "Hoàn tiền gói dịch vụ",
  SUBSCRIPTION_REFUND_REJECTED: "Từ chối hoàn tiền gói dịch vụ",
  SUBSCRIPTION_REFUND_PAYOUT_VIEWED: "Xem thông tin nhận tiền hoàn gói",
  ORDER_NOTE_ADDED: "Thêm ghi chú nội bộ cho đơn",
  ORDER_NOTE_DELETED: "Xoá ghi chú nội bộ của đơn",
  CUSTOMER_NOTE_UPDATED: "Cập nhật ghi chú khách hàng",
  HOME_CMS_UPDATED: "Cập nhật trang chủ",
  MENU_CMS_UPDATED: "Cập nhật menu header/footer",
  LEGAL_VERSION_CREATED: "Tạo phiên bản văn bản pháp lý",
  LEGAL_VERSION_UPDATED: "Sửa bản nháp văn bản pháp lý",
  LEGAL_REVIEW_STATUS_CHANGED: "Đổi trạng thái rà soát nội dung",
  LEGAL_VERSION_PUBLISHED: "Xuất bản văn bản pháp lý",
  LEGAL_VERSION_ARCHIVED: "Lưu trữ văn bản pháp lý",
  LEGAL_DOCUMENT_META_UPDATED: "Cập nhật mô tả/SEO văn bản pháp lý",
  ORDER_PAYMENT_EMAIL_SENT: "Gửi email hướng dẫn thanh toán cho khách",
  ORDER_CUSTOMER_DECLARED_PAID: "Khách báo đã chuyển khoản",
  ORDER_CUSTOMER_DECLARED_PAID_UNDONE: "Khách huỷ báo đã chuyển khoản",
  ORDER_CANCELED_BY_CUSTOMER: "Khách huỷ đơn",
  AUTH_GUEST_ACCOUNT_CREATED: "Tạo tài khoản khi mua (khách vãng lai)",
  AUTH_GUEST_ACTIVATED: "Kích hoạt tài khoản và đặt mật khẩu",
  SUBSCRIPTION_INVOICE_VOIDED: "Huỷ hoá đơn gói dịch vụ",
  SUBSCRIPTION_INVOICE_REOPENED: "Mở lại hoá đơn gói dịch vụ",
  ORDER_CANCELED_BY_SELLER: "Người bán huỷ đơn",
  ORDER_REOPENED_BY_SELLER: "Người bán mở lại đơn",
  SUBSCRIPTION_INVOICE_CREATED: "Tạo hoá đơn gói dịch vụ",
};

export const AUDIT_SCOPE_LABELS: Record<AuditScopeValue, string> = {
  SYSTEM: "Hệ thống",
  TENANT: "Gian hàng",
  CUSTOMER: "Khách hàng",
};

export function auditActionLabel(action: string): string {
  return isAuditAction(action) ? AUDIT_ACTION_LABELS[action] : action;
}

// ───────────────────────── Lọc metadata ─────────────────────────

/**
 * Khoá nhạy cảm — giá trị bị thay bằng "[REDACTED]" ở mọi độ sâu (cùng tinh thần REDACT_PATHS của logger, nhưng
 * so khớp theo tên khoá thay vì đường dẫn cố định). ADR-037: metadata không bao giờ chứa secret/token/mật khẩu/hash.
 */
const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|hash|authorization|cookie|api[-_]?key|private[-_]?key|signature|otp/i;

export const AUDIT_REDACTED = "[REDACTED]";
const MAX_DEPTH = 4;
const MAX_KEYS = 40;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 500;
/** Giới hạn kích thước JSON sau khi lọc — vượt thì chỉ giữ cờ `truncated`. */
export const AUDIT_METADATA_MAX_BYTES = 4096;

export type AuditJsonValue = string | number | boolean | null | AuditJsonValue[] | { [key: string]: AuditJsonValue };
export type AuditMetadata = { [key: string]: AuditJsonValue };

function sanitizeValue(value: unknown, depth: number): AuditJsonValue | undefined {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    default:
      break;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item): item is AuditJsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  return undefined;
}

function sanitizeObject(input: Record<string, unknown>, depth: number): AuditMetadata {
  const out: AuditMetadata = {};
  for (const [key, raw] of Object.entries(input).slice(0, MAX_KEYS)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = AUDIT_REDACTED;
      continue;
    }
    const value = sanitizeValue(raw, depth);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Chuẩn hoá metadata trước khi ghi: bỏ khoá nhạy cảm, giá trị không phải JSON, cắt chuỗi/mảng dài, giới hạn độ sâu
 * và tổng kích thước. Không bao giờ ném.
 */
export function sanitizeAuditMetadata(input: Record<string, unknown> | null | undefined): AuditMetadata {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const sanitized = sanitizeObject(input, 0);
  if (JSON.stringify(sanitized).length > AUDIT_METADATA_MAX_BYTES) {
    return { truncated: true };
  }
  return sanitized;
}

// ───────────────────────── Che email ─────────────────────────

/** `nguyen@gmail.com` → `n***@gmail.com`. Chuỗi không có `@` → `***`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

// ───────────────────────── Thông tin request ─────────────────────────

export const AUDIT_IP_MAX_LENGTH = 64;
export const AUDIT_USER_AGENT_MAX_LENGTH = 512;

/** IP từ `x-forwarded-for` (phần tử đầu) hoặc `x-real-ip`, cắt độ dài; rỗng → null. */
export function extractAuditIp(forwardedFor: string | null | undefined, realIp?: string | null): string | null {
  const first = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "";
  return first ? first.slice(0, AUDIT_IP_MAX_LENGTH) : null;
}

export function normalizeAuditUserAgent(userAgent: string | null | undefined): string | null {
  const value = userAgent?.trim();
  return value ? value.slice(0, AUDIT_USER_AGENT_MAX_LENGTH) : null;
}
