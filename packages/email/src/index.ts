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

export {
  renderEmailChangedEmail,
  renderEmailChangeRequestedEmail,
  renderEmailChangeVerifyEmail,
  renderPasswordChangedEmail,
} from "./templates/account-security";
export type {
  EmailChangedTemplateData,
  EmailChangeRequestedTemplateData,
  EmailChangeVerifyTemplateData,
  PasswordChangedTemplateData,
} from "./templates/account-security";

// ADR-041 B — hoàn tiền gói dịch vụ
export { renderSubscriptionRefundEmail } from "./templates/subscription-refund";
export type { SubscriptionRefundEmailData, SubscriptionRefundEmailStage } from "./templates/subscription-refund";

// ADR-059 — báo đơn/hoá đơn chờ xác nhận tay
export {
  renderInvoiceAwaitingReconciliationEmail,
  renderOrderAwaitingManualConfirmEmail,
  renderPaymentAmountMismatchEmail,
} from "./templates/manual-payment-pending";
export type {
  InvoiceAwaitingReconciliationTemplateData,
  OrderAwaitingManualConfirmTemplateData,
  PaymentAmountMismatchTemplateData,
} from "./templates/manual-payment-pending";

// ADR-061/062 — email luồng mua của khách
export { renderCustomerDeclaredPaidEmail, renderOrderPaymentInstructionsEmail } from "./templates/order-payment";
export type { CustomerDeclaredPaidTemplateData, OrderPaymentInstructionsTemplateData } from "./templates/order-payment";

// ADR-061 Q1 — kích hoạt tài khoản khách vãng lai + đặt mật khẩu
export { renderGuestActivationEmail } from "./templates/guest-activation";
export type { GuestActivationTemplateData } from "./templates/guest-activation";
