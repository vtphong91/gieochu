export {
  createEmailSenderFromEnv,
  createResendSender,
  createSmtpSender,
} from "./sender";
export type { EmailEnv, EmailMessage, EmailSender } from "./sender";

export { renderVerifyEmailTemplate } from "./templates/verify-email";
export type { RenderedEmail, VerifyEmailTemplateData } from "./templates/verify-email";

export { renderResetPasswordEmailTemplate } from "./templates/reset-password";
export type { ResetPasswordTemplateData } from "./templates/reset-password";

export { renderSubscriptionStatusEmail } from "./templates/subscription-billing";
export type { SubscriptionEmailStage, SubscriptionStatusEmailData } from "./templates/subscription-billing";

export { renderProductFileRejectedEmail } from "./templates/product-file-rejected";
export type { ProductFileRejectedTemplateData } from "./templates/product-file-rejected";
