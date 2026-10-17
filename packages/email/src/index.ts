export {
  createEmailSenderFromEnv,
  createResendSender,
  createSmtpSender,
  verifySmtpConnection,
} from "./sender";
export type { EmailEnv, EmailMessage, EmailSender, SmtpConnectionOptions } from "./sender";

export { renderVerifyEmailTemplate } from "./templates/verify-email";
export type { RenderedEmail, VerifyEmailTemplateData } from "./templates/verify-email";

export { renderResetPasswordEmailTemplate } from "./templates/reset-password";
export type { ResetPasswordTemplateData } from "./templates/reset-password";

export { renderSubscriptionStatusEmail } from "./templates/subscription-billing";
export type { SubscriptionEmailStage, SubscriptionStatusEmailData } from "./templates/subscription-billing";

export { renderProductFileRejectedEmail } from "./templates/product-file-rejected";
export type { ProductFileRejectedTemplateData } from "./templates/product-file-rejected";

export { renderOrderPaidEmail } from "./templates/order-paid";
export type { OrderPaidTemplateData } from "./templates/order-paid";

export { renderNewSaleEmail } from "./templates/new-sale";
export type { NewSaleTemplateData } from "./templates/new-sale";

export { renderStorefrontMessageEmail } from "./templates/storefront-message";
export type { StorefrontMessageTemplateData } from "./templates/storefront-message";

export { renderNewReviewEmail } from "./templates/new-review";
export type { NewReviewTemplateData } from "./templates/new-review";

export { renderAbuseReportResolvedEmail, renderContentModeratedEmail } from "./templates/abuse-report";
export type { AbuseReportResolvedTemplateData, ContentModeratedTemplateData } from "./templates/abuse-report";
export { renderPurchaseRemedyCustomerEmail, renderPurchaseRemedyTenantEmail, renderRefundRequestedEmail } from "./templates/entitlement-remedy";
export type {
  PurchaseRemedyCustomerTemplateData,
  PurchaseRemedyTenantTemplateData,
  RefundRequestedTemplateData,
} from "./templates/entitlement-remedy";
