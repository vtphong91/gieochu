import { PLAN_LIMIT_UNLIMITED } from "../billing/plan-limits";
export type PublishBlockReason =
  | "CATEGORY_REQUIRED"
  | "CATEGORY_INACTIVE"
  | "NO_DELIVERY_SOURCE"
  | "NO_COVER_IMAGE"
  | "INVALID_PRICE"
  | "TENANT_NOT_ACTIVE"
  | "PRODUCT_LIMIT_REACHED";

/** Mục checklist hiển thị ở editor — mỗi mục gom một hoặc nhiều `PublishBlockReason`. */
export type PublishRequirement = "CATEGORY" | "COVER_IMAGE" | "DELIVERY_SOURCE" | "PRICE" | "TENANT_ACTIVE" | "PRODUCT_LIMIT";

export interface PublishEligibilityInput {
  /** ADR-026: `missing` = chưa chọn danh mục; `inactive` = danh mục đã bị System Admin tắt. */
  categoryStatus: "missing" | "inactive" | "active";
  /** ≥1 file bán (không phải preview) `CLEAN`, chưa gỡ. */
  hasCleanSaleFile: boolean;
  /** ≥1 link tài liệu ngoài chưa gỡ và còn nằm trong allowlist (ADR-026). */
  hasValidExternalLink: boolean;
  /** ADR-027: có `coverImageUrl` Cloudinary hợp lệ HOẶC `coverImageKey` R2 cũ. */
  hasCoverImage: boolean;
  priceVnd: number;
  tenantStatus: "ACTIVE" | "READ_ONLY" | "LOCKED";
  currentPublishedCount: number;
  maxProducts: number;
}

export interface PublishBlock {
  code: PublishBlockReason;
  message: string;
}

export interface PublishChecklistItem {
  requirement: PublishRequirement;
  label: string;
  passed: boolean;
  /** Lý do chưa đạt (chỉ có khi `passed = false`). */
  message?: string;
}

export interface PublishEligibilityResult {
  allowed: boolean;
  reasons: PublishBlock[];
  checklist: PublishChecklistItem[];
}

const MESSAGES: Record<PublishBlockReason, string> = {
  CATEGORY_REQUIRED: "Chưa chọn danh mục tài liệu.",
  CATEGORY_INACTIVE: "Danh mục đã chọn đang ngừng hoạt động — hãy chọn danh mục khác.",
  NO_DELIVERY_SOURCE: "Cần ít nhất 1 file bán đã quét an toàn hoặc 1 link tài liệu hợp lệ.",
  NO_COVER_IMAGE: "Chưa có ảnh bìa.",
  INVALID_PRICE: "Giá bán không hợp lệ.",
  TENANT_NOT_ACTIVE: "Trang đang tạm ngưng bán.",
  PRODUCT_LIMIT_REACHED: "Đã đạt giới hạn số sản phẩm xuất bản của gói.",
};

const REQUIREMENTS: { requirement: PublishRequirement; label: string; codes: PublishBlockReason[] }[] = [
  { requirement: "CATEGORY", label: "Có danh mục đang hoạt động", codes: ["CATEGORY_REQUIRED", "CATEGORY_INACTIVE"] },
  { requirement: "COVER_IMAGE", label: "Có ảnh bìa", codes: ["NO_COVER_IMAGE"] },
  { requirement: "DELIVERY_SOURCE", label: "Có file bán hoặc link tài liệu", codes: ["NO_DELIVERY_SOURCE"] },
  { requirement: "PRICE", label: "Giá bán hợp lệ", codes: ["INVALID_PRICE"] },
  { requirement: "TENANT_ACTIVE", label: "Trang đang hoạt động", codes: ["TENANT_NOT_ACTIVE"] },
  { requirement: "PRODUCT_LIMIT", label: "Còn chỗ trong giới hạn sản phẩm của gói", codes: ["PRODUCT_LIMIT_REACHED"] },
];

/**
 * §"M5" + ADR-026: có danh mục đang hoạt động, ảnh bìa, ≥1 nguồn giao hàng hợp lệ (file bán CLEAN **hoặc**
 * link ngoài hợp lệ), giá hợp lệ, tenant ACTIVE, chưa vượt giới hạn số sản phẩm. Trả mọi lý do chặn (không
 * dừng ở lý do đầu) kèm checklist để UI hiển thị.
 */
export function canPublishProduct(input: PublishEligibilityInput): PublishEligibilityResult {
  const codes: PublishBlockReason[] = [];
  if (input.categoryStatus === "missing") codes.push("CATEGORY_REQUIRED");
  if (input.categoryStatus === "inactive") codes.push("CATEGORY_INACTIVE");
  if (!input.hasCleanSaleFile && !input.hasValidExternalLink) codes.push("NO_DELIVERY_SOURCE");
  if (!input.hasCoverImage) codes.push("NO_COVER_IMAGE");
  if (!Number.isInteger(input.priceVnd) || input.priceVnd < 0) codes.push("INVALID_PRICE");
  if (input.tenantStatus !== "ACTIVE") codes.push("TENANT_NOT_ACTIVE");
  // ADR-041 A4: -1 = không giới hạn; 0 = không được phép.
  if (input.maxProducts !== PLAN_LIMIT_UNLIMITED && input.currentPublishedCount >= input.maxProducts) codes.push("PRODUCT_LIMIT_REACHED");

  const reasons = codes.map((code) => ({ code, message: MESSAGES[code] }));
  const checklist = REQUIREMENTS.map(({ requirement, label, codes: owned }) => {
    const failed = reasons.find((r) => owned.includes(r.code));
    return failed ? { requirement, label, passed: false, message: failed.message } : { requirement, label, passed: true };
  });
  return { allowed: reasons.length === 0, reasons, checklist };
}
