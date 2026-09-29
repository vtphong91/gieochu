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
export {
  defaultStorefrontPostsSection,
  defaultStorefrontReviewsSection,
  defaultStorefrontSections,
  isCloudinaryImageUrl,
  isSafeStorefrontHref,
  storefrontImageUrls,
  STOREFRONT_PRODUCTS_LIMIT_MAX,
  STOREFRONT_PRODUCTS_LIMIT_MIN,
  STOREFRONT_POSTS_LIMIT_MAX,
  STOREFRONT_POSTS_LIMIT_MIN,
  STOREFRONT_REVIEWS_LIMIT_MAX,
  STOREFRONT_REVIEWS_LIMIT_MIN,
  STOREFRONT_REVIEWS_PINNED_MAX,
  STOREFRONT_SECTION_LABELS,
  STOREFRONT_SERVICE_ICON_LABELS,
  STOREFRONT_SERVICE_ICONS,
  storefrontSectionSchema,
  storefrontSectionsSchema,
} from "./tenant/storefront-sections";
export type {
  StorefrontContactData,
  StorefrontCta,
  StorefrontHeroData,
  StorefrontPostsData,
  StorefrontProductsData,
  StorefrontReviewsData,
  StorefrontSection,
  StorefrontSectionData,
  StorefrontSectionType,
  StorefrontServiceIcon,
  StorefrontServicesData,
  StorefrontTestimonialsData,
} from "./tenant/storefront-sections";
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

export { CLOUDINARY_DELIVERY_HOST, CLOUDINARY_MAX_DELIVERY_WIDTH, cloudinaryDeliveryUrl } from "./content/cloudinary-url";
export type { CloudinaryDeliveryOptions } from "./content/cloudinary-url";

export {
  buildPostExcerpt,
  countRichTextImages,
  firstRichTextImageSrc,
  htmlToPlainText,
  normalizePostTitle,
  POST_BODY_MAX_LENGTH,
  POST_EXCERPT_MAX_LENGTH,
  POST_MAX_IMAGES,
  POST_STATUS_LABELS,
  POST_TITLE_MAX_LENGTH,
  richTextImageSrcs,
} from "./content/post";
export type { PostTitleResult } from "./content/post";

export { suggestSlug } from "./product/slug-suggestion";
export { isReservedProductSlug, productPath, productUrl, RESERVED_PRODUCT_SLUGS } from "./product/path";
export { canPublishProduct } from "./product/publish-eligibility";
export type {
  PublishBlock,
  PublishBlockReason,
  PublishChecklistItem,
  PublishEligibilityInput,
  PublishEligibilityResult,
  PublishRequirement,
} from "./product/publish-eligibility";
export {
  EXTERNAL_DOCUMENT_EXACT_HOSTS,
  EXTERNAL_DOCUMENT_URL_MAX_LENGTH,
  EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES,
  isAllowedExternalDocumentUrl,
  normalizeExternalDocumentUrl,
} from "./product/external-document-url";
export { applyStorageDelta } from "./product/storage-accounting";
export { normalizeProductSummary, PRODUCT_SUMMARY_MAX_LENGTH } from "./product/summary";
export type { ProductSummaryResult } from "./product/summary";

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

export {
  computeRatingAverage,
  formatReviewerDisplayName,
  isTenantReviewHideReason,
  normalizeReviewText,
  parseReviewRating,
  REVIEW_ANONYMOUS_NAME,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_HIDDEN_REASON_LABELS,
  REVIEW_HIDDEN_REASONS,
  REVIEW_RATING_MAX,
  REVIEW_RATING_MIN,
  REVIEW_REPLY_MAX_LENGTH,
  TENANT_REVIEW_HIDE_REASONS,
} from "./review/review";
export type { ReviewHiddenReasonValue, ReviewTextResult, TenantReviewHideReason } from "./review/review";

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

export {
  DEFAULT_SYSTEM_SETTINGS,
  DISPLAY_TIME_ZONE,
  parseStoredSystemSettings,
  SYSTEM_SETTING_KEYS,
  SYSTEM_SETTINGS_BOUNDS,
  systemSettingsSchema,
} from "./settings/system-settings";
export type {
  ParsedStoredSystemSettings,
  SystemSettingBound,
  SystemSettingKey,
  SystemSettingsValues,
} from "./settings/system-settings";
