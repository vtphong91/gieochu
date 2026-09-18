/** §"M3 v2" ADR-021: keys business logic may gate on — never `plan.code`, only these flags. */
export type PlanFeatureKey =
  | "coupons"
  | "advancedAnalytics"
  | "advancedBranding"
  | "seoTools"
  | "automation"
  | "customDomain";

/** `features[key] !== true` (missing/false/anything else) means the feature is off. */
export function canUsePlanFeature(features: Record<string, unknown>, key: PlanFeatureKey): boolean {
  return features[key] === true;
}
