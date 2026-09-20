export {
  AppError,
  ErrorCodes,
  conflict,
  forbidden,
  internalError,
  notFound,
  rateLimited,
  toHttpError,
  unauthorized,
} from "./errors";
export type { AppErrorOptions, ErrorResponseBody } from "./errors";

export { createLogger, logger, loggerWithRequestId } from "./logger";
export type { CreateLoggerOptions } from "./logger";

export { decryptSecret, encryptSecret, maskSecret } from "./crypto/encryption";
export { generateOpaqueToken, hashOpaqueToken } from "./crypto/random-token";

export { isReservedSlug, RESERVED_SLUGS, slugify } from "./tenant/slug";
export { generateOrderCodePrefix, isValidOrderCodePrefix } from "./tenant/order-code-prefix";
export { isValidHexColor, isValidSocialLink } from "./tenant/branding";
export type { SocialLinkKey } from "./tenant/branding";
export { resolveStorefrontAccess } from "./tenant/access-policy";
export type { StorefrontAccessDecision, StorefrontViewer, TenantStatus } from "./tenant/access-policy";
export { canManageTenant } from "./tenant/membership";
export type { TenantMemberRole } from "./tenant/membership";

export { addBillingPeriod, computeGraceEndsAt, computeRenewalPeriod } from "./billing/period";
export type { PlanInterval, PlanIntervalInfo } from "./billing/period";
export { generateInvoiceCode, isValidInvoiceCode } from "./billing/invoice-code";
export { transitionSubscriptionStatus } from "./billing/subscription-state";
export type { SubscriptionEvent, SubscriptionStatus } from "./billing/subscription-state";
export { isWithinPlanLimit } from "./billing/plan-limits";
export type { PlanLimitKind, PlanLimits } from "./billing/plan-limits";
export { canUsePlanFeature } from "./billing/feature-gate";
export type { PlanFeatureKey } from "./billing/feature-gate";

export { suggestSlug } from "./product/slug-suggestion";
export { canPublishProduct } from "./product/publish-eligibility";
export type { PublishBlockReason, PublishEligibilityInput, PublishEligibilityResult } from "./product/publish-eligibility";
export { applyStorageDelta } from "./product/storage-accounting";

export { calculatePrice } from "./pricing/calculate-price";
export type {
  CalculatePriceInput,
  CalculatePriceResult,
  CouponErrorCode,
  CouponSnapshot,
  CouponType,
  PricedLine,
  PricingLineInput,
} from "./pricing/calculate-price";

export { transitionOrderStatus } from "./order/state";
export type { OrderEvent, OrderStatus } from "./order/state";
export { generateOrderCode, isValidOrderCode } from "./order/code";
export { canManuallyConfirmOrder, computeOrderExpiresAt } from "./order/expiry";
export { matchPaymentAmount } from "./order/payment-match";
export type { PaymentMatchStatus } from "./order/payment-match";
export { calculateOrderPricing } from "./order/pricing";
export type { OrderPricedLine, OrderPricingResult, OrderProductSnapshot } from "./order/pricing";
export { canPurchaseProduct } from "./order/purchase-guard";
export type { PurchaseBlockReason, PurchaseGuardResult } from "./order/purchase-guard";
export { applyOrderToCustomerStats } from "./order/customer-stats";
export type { TenantCustomerStats } from "./order/customer-stats";

export { createDownloadToken, evaluateDownloadToken } from "./download/token";
export type { DownloadTokenRecord, DownloadTokenStatus, NewDownloadToken } from "./download/token";
export { canDownloadEntitlement } from "./download/entitlement-guard";
export type { DownloadBlockReason, DownloadGuardResult, EntitlementSnapshot } from "./download/entitlement-guard";
export { isShareLinkUsable } from "./download/share-link";
export type { ShareLinkBlockReason, ShareLinkSnapshot, ShareLinkUsability } from "./download/share-link";
export { hashSharePassword, verifySharePassword } from "./download/share-link-password";

export { decideLockUser } from "./admin/user-lock";
export type { LockRejectReason, LockTargetUser, LockUserDecision } from "./admin/user-lock";
export { isValidPlanInput } from "./admin/plan-validation";
export type { PlanInput } from "./admin/plan-validation";
export { cmsBlocksSchema, isValidCmsBlocks } from "./admin/cms-blocks";
export { homeSectionsSchema, homeSectionSchema, isValidHomeSections, HOME_SECTION_LABELS } from "./admin/home-sections";
export type { HomeSection, HomeSectionType } from "./admin/home-sections";
export { buildAdminDashboardSummary } from "./admin/dashboard-summary";
export type { AdminDashboardCounts, AdminDashboardSummary } from "./admin/dashboard-summary";
