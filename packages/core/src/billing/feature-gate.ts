/** §"M3 v2" ADR-021: keys business logic may gate on — never `plan.code`, only these flags. */
export type PlanFeatureKey =
  | "coupons"
  | "advancedAnalytics"
  | "advancedBranding"
  | "seoTools"
  | "automation"
  | "customDomain";

/** Toàn bộ cờ tính năng lưu trong `Plan.features` (thứ tự hiển thị ở form `/admin/plans`). */
export const PLAN_FEATURE_KEYS: readonly PlanFeatureKey[] = [
  "coupons",
  "advancedAnalytics",
  "advancedBranding",
  "seoTools",
  "automation",
  "customDomain",
];

/** Nhãn tiếng Việt của cờ tính năng (form gói, bảng so sánh trang Bảng giá). */
export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  coupons: "Mã giảm giá",
  advancedAnalytics: "Thống kê nâng cao",
  advancedBranding: "Thương hiệu nâng cao",
  seoTools: "Công cụ SEO",
  automation: "Tự động hoá",
  customDomain: "Tên miền riêng",
};

/**
 * ADR-041 A3 — cờ tính năng **đã triển khai VÀ đã chặn theo gói** (có lời gọi `assertPlanFeature` thật). Chỉ cờ trong
 * danh sách này mới được quảng cáo ở trang Bảng giá (dòng `feature` của bảng so sánh, quyền lợi tự sinh). Hiện chưa
 * cờ nào được chặn ở đâu (2026-10-17) → danh sách rỗng. Khi gắn `assertPlanFeature` cho một tính năng thật, thêm
 * khoá vào đây cùng commit.
 */
export const IMPLEMENTED_PLAN_FEATURES: readonly PlanFeatureKey[] = [];

export function isPlanFeatureKey(value: unknown): value is PlanFeatureKey {
  return typeof value === "string" && (PLAN_FEATURE_KEYS as readonly string[]).includes(value);
}

export function isImplementedPlanFeature(key: PlanFeatureKey): boolean {
  return IMPLEMENTED_PLAN_FEATURES.includes(key);
}

/** `features[key] !== true` (missing/false/anything else) means the feature is off. */
export function canUsePlanFeature(features: Record<string, unknown>, key: PlanFeatureKey): boolean {
  return features[key] === true;
}
