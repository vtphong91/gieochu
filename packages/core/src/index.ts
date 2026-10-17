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
export {
  describePlanLimit,
  formatPlanLimit,
  isUnlimitedPlanLimit,
  isWithinPlanLimit,
  PLAN_LIMIT_FIELD_LABELS,
  PLAN_LIMIT_FIELDS,
  PLAN_LIMIT_UNLIMITED,
} from "./billing/plan-limits";
export type { PlanLimitDisplay, PlanLimitField, PlanLimitKind, PlanLimits } from "./billing/plan-limits";
export {
  canUsePlanFeature,
  IMPLEMENTED_PLAN_FEATURES,
  isImplementedPlanFeature,
  isPlanFeatureKey,
  PLAN_FEATURE_KEYS,
  PLAN_FEATURE_LABELS,
} from "./billing/feature-gate";
export type { PlanFeatureKey } from "./billing/feature-gate";
export {
  evaluateRefundEligibility,
  maskAccountNo,
  normalizeRefundText,
  parseRefundPayoutInput,
  REFUND_INELIGIBLE_MESSAGES,
  refundDeadline,
  SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX,
  SUBSCRIPTION_REFUND_ERROR_CODES,
  SUBSCRIPTION_REFUND_REASON_MAX,
  SUBSCRIPTION_REFUND_STATUS_LABELS,
  SUBSCRIPTION_REFUND_STATUSES,
  SUBSCRIPTION_REFUND_WINDOW_DAYS,
} from "./billing/subscription-refund";
export type {
  RefundEligibility,
  RefundIneligibleReason,
  RefundPayoutDetails,
  RefundPayoutField,
  SubscriptionRefundStatusValue,
} from "./billing/subscription-refund";

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
export { PRODUCT_TYPE_LABELS, PRODUCT_TYPES, productTypeLabel } from "./product/type-label";
export type { ProductTypeValue } from "./product/type-label";
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
export { canManuallyConfirmOrder, computeOrderExpiresAt, effectiveOrderStatus } from "./order/expiry";
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
export {
  ENTITLEMENT_REMEDY_ERROR_CODES,
  ENTITLEMENT_REMEDY_STATUS_LABELS,
  ENTITLEMENT_REMEDY_STATUSES,
  isEntitlementRemedyStatus,
  REMEDY_REFUND_SLA_DAYS,
  remedyDownloadBlock,
} from "./download/entitlement-remedy";
export type { EntitlementRemedyStatusValue, RemedyDownloadBlock } from "./download/entitlement-remedy";
export { isShareLinkUsable } from "./download/share-link";
export type { ShareLinkBlockReason, ShareLinkSnapshot, ShareLinkUsability } from "./download/share-link";
export { hashSharePassword, verifySharePassword } from "./download/share-link-password";

export { decideLockUser } from "./admin/user-lock";
export type { LockRejectReason, LockTargetUser, LockUserDecision } from "./admin/user-lock";
export { isValidPlanInput } from "./admin/plan-validation";
export type { PlanInput } from "./admin/plan-validation";
export { cmsBlocksSchema, isValidCmsBlocks } from "./admin/cms-blocks";
export {
  homeSectionsSchema,
  homeSectionSchema,
  isValidHomeSections,
  parseHomeSections,
  defaultHomeStatsData,
  HOME_SECTION_LABELS,
  HOME_STAT_KEYS,
  HOME_STAT_DEFAULT_LABELS,
  HOME_FEATURED_LIMIT_MIN,
  HOME_FEATURED_LIMIT_MAX,
  HOME_PINNED_MAX,
  HOME_COACHES_DEFAULT_LIMIT,
  HOME_DOCUMENTS_DEFAULT_LIMIT,
  DEFAULT_HOME_SEARCH_DATA,
  DEFAULT_HOME_COACHES_TEXT,
  DEFAULT_HOME_DOCUMENTS_TEXT,
} from "./admin/home-sections";
export type { HomeSection, HomeSectionType, HomeStatKey } from "./admin/home-sections";
export { HOME_CMS_SLUG, isSystemCmsSlug, PRICING_CMS_SLUG, SHOP_CMS_SLUG, SYSTEM_CMS_SLUGS } from "./admin/cms-slugs";
export type { SystemCmsSlug } from "./admin/cms-slugs";
export {
  defaultShopSectionData,
  defaultShopSectionId,
  defaultShopSections,
  DEFAULT_SHOP_SECTIONS,
  formatShopAvgTenths,
  isInternalShopHref,
  isValidShopSections,
  parseShopAvgTenthsInput,
  parseShopSections,
  resolveShopSections,
  shopSectionSchema,
  shopSectionsSchema,
  SHOP_BY_CATEGORY_BLOCKS_MAX,
  SHOP_BY_CATEGORY_BLOCKS_MIN,
  SHOP_BY_CATEGORY_CARDS_MAX,
  SHOP_BY_CATEGORY_CARDS_MIN,
  SHOP_CATEGORIES_VISIBLE_MAX,
  SHOP_CATEGORIES_VISIBLE_MIN,
  SHOP_CATEGORY_MODE_LABELS,
  SHOP_CATEGORY_MODES,
  SHOP_FEATURED_TENANTS_MODE_LABELS,
  SHOP_FEATURED_TENANTS_MODES,
  SHOP_HERO_CHIPS_MAX,
  SHOP_HERO_CHIPS_MIN,
  SHOP_LIMIT_MAX,
  SHOP_LIMIT_MIN,
  SHOP_MIN_AVG_TENTHS_MAX,
  SHOP_MIN_AVG_TENTHS_MIN,
  SHOP_MIN_REVIEWS_MAX,
  SHOP_MIN_REVIEWS_MIN,
  SHOP_PINNED_MAX,
  SHOP_SECTION_LABELS,
  SHOP_SECTION_TYPES,
  SHOP_TENANT_LIMIT_MAX,
  SHOP_TENANT_LIMIT_MIN,
} from "./admin/shop-sections";
export type {
  ShopByCategoryData,
  ShopCategoriesData,
  ShopCategoryMode,
  ShopCtaOpenStoreData,
  ShopFeaturedData,
  ShopFeaturedTenantsData,
  ShopFeaturedTenantsMode,
  ShopHeroData,
  ShopSection,
  ShopSectionData,
  ShopSectionType,
  ShopShelfData,
  ShopTopRatedData,
} from "./admin/shop-sections";
export {
  applyPricingTemplate,
  applyPricingTemplateDeep,
  computeCycleSavingsPercent,
  defaultPricingSections,
  parsePricingSections,
  PRICING_SECTION_LABELS,
  PRICING_SECTION_TYPES,
  PRICING_SEO_DESCRIPTION_MAX,
  PRICING_SEO_TITLE_MAX,
  pricingSectionsSchema,
  pricingSeoSchema,
  resolvePricingPlanSlots,
  resolvePricingSections,
  stripUndefinedPricing,
  validatePricingPlanRefs,
} from "./admin/pricing-sections";
export type {
  PricingComparisonRow,
  PricingCtaKey,
  PricingCtaLabels,
  PricingPlanCardItem,
  PricingPlanCardSlot,
  PricingSection,
  PricingSectionIssue,
  PricingSectionType,
  PricingSeoInput,
} from "./admin/pricing-sections";
export { buildAdminDashboardSummary } from "./admin/dashboard-summary";
export type { AdminDashboardCounts, AdminDashboardSummary } from "./admin/dashboard-summary";

export {
  DEFAULT_SYSTEM_SETTINGS,
  DISPLAY_TIME_ZONE,
  INACTIVE_SYSTEM_SETTINGS,
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

export {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_IP_MAX_LENGTH,
  AUDIT_METADATA_MAX_BYTES,
  AUDIT_REDACTED,
  AUDIT_SCOPE_LABELS,
  AUDIT_SCOPES,
  AUDIT_USER_AGENT_MAX_LENGTH,
  auditActionLabel,
  extractAuditIp,
  isAuditAction,
  isAuditScope,
  maskEmail,
  normalizeAuditUserAgent,
  sanitizeAuditMetadata,
} from "./audit/audit";
export type { AuditAction, AuditJsonValue, AuditMetadata, AuditScopeValue } from "./audit/audit";

export {
  ABUSE_REPORT_DECISION_LABELS,
  ABUSE_REPORT_DECISIONS,
  ABUSE_REPORT_DESCRIPTION_MAX_LENGTH,
  ABUSE_REPORT_ERROR_CODES,
  ABUSE_REPORT_EVIDENCE_MAX,
  ABUSE_REPORT_HONEYPOT_FIELD,
  ABUSE_REPORT_NOTE_MAX_LENGTH,
  ABUSE_REPORT_RATE_LIMIT,
  ABUSE_REPORT_RATE_WINDOW_MS,
  ABUSE_REPORT_STATUS_LABELS,
  ABUSE_REPORT_STATUSES,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_REPORT_TYPES,
  ABUSE_TARGET_TYPE_LABELS,
  ABUSE_TARGET_TYPES,
  abuseReportSubmissionSchema,
  allowedAbuseDecisions,
  CONTENT_MODERATION_LOCKED_MESSAGE,
  isAbuseReportDecision,
  isAbuseReportStatus,
  isAbuseReportType,
  isAbuseTargetType,
  isEnforcementDecision,
  normalizeEvidenceUrl,
  normalizeReportText,
} from "./report/abuse-report";
export type {
  AbuseReportDecisionValue,
  AbuseReportStatusValue,
  AbuseReportSubmission,
  AbuseReportTypeValue,
  AbuseTargetTypeValue,
} from "./report/abuse-report";
