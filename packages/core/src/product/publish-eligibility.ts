export type PublishBlockReason =
  | "NO_CLEAN_SALE_FILE"
  | "NO_COVER_IMAGE"
  | "INVALID_PRICE"
  | "TENANT_NOT_ACTIVE"
  | "PRODUCT_LIMIT_REACHED";

export interface PublishEligibilityInput {
  hasCleanSaleFile: boolean;
  hasCoverImage: boolean;
  priceVnd: number;
  tenantStatus: "ACTIVE" | "READ_ONLY" | "LOCKED";
  currentPublishedCount: number;
  maxProducts: number;
}

export interface PublishEligibilityResult {
  allowed: boolean;
  reasons: PublishBlockReason[];
}

/** §"M5": "có ít nhất 1 file bán CLEAN, có ảnh bìa, giá hợp lệ, tenant ACTIVE, chưa vượt giới hạn số sản phẩm". */
export function canPublishProduct(input: PublishEligibilityInput): PublishEligibilityResult {
  const reasons: PublishBlockReason[] = [];
  if (!input.hasCleanSaleFile) reasons.push("NO_CLEAN_SALE_FILE");
  if (!input.hasCoverImage) reasons.push("NO_COVER_IMAGE");
  if (!Number.isInteger(input.priceVnd) || input.priceVnd < 0) reasons.push("INVALID_PRICE");
  if (input.tenantStatus !== "ACTIVE") reasons.push("TENANT_NOT_ACTIVE");
  if (input.currentPublishedCount >= input.maxProducts) reasons.push("PRODUCT_LIMIT_REACHED");
  return { allowed: reasons.length === 0, reasons };
}
