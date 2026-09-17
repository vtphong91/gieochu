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
