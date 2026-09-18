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

export { decideLockUser } from "./admin/user-lock";
export type { LockRejectReason, LockTargetUser, LockUserDecision } from "./admin/user-lock";
export { isValidPlanInput } from "./admin/plan-validation";
export type { PlanInput } from "./admin/plan-validation";
export { cmsBlocksSchema, isValidCmsBlocks } from "./admin/cms-blocks";
export { buildAdminDashboardSummary } from "./admin/dashboard-summary";
export type { AdminDashboardCounts, AdminDashboardSummary } from "./admin/dashboard-summary";
