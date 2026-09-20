import nodemailer from "nodemailer";

export interface EmailMessage {
  /**
   * Nhãn loại email (vd: "verify_email", "reset_password",
   * "subscription_grace", "order_paid"...) — dùng để ghi Lịch sử gửi ở System
   * Admin (apps/web/lib/email-dispatch.ts). Loại `order_paid`/`new_sale` (gửi
   * tới khách hàng cuối của tenant) bị loại trừ khỏi log đó theo thiết kế.
   */
  type: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** §3: adapter EmailSender — Resend (prod) / SMTP → Mailpit (dev). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface SmtpConnectionOptions {
  host: string;
  port: number;
  /** true = SSL/TLS trực tiếp (port 465), false = STARTTLS hoặc không mã hoá (port 587/25, Mailpit dev). */
  secure?: boolean;
  auth?: { user: string; pass: string };
}

export function createSmtpSender(options: SmtpConnectionOptions & { from: string; replyTo?: string }): EmailSender {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: options.auth,
  });
  return {
    async send(message) {
      await transporter.sendMail({
        from: options.from,
        replyTo: options.replyTo,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    },
  };
}

/** Xác thực kết nối + đăng nhập SMTP thật (dùng cho "Kiểm tra kết nối" ở System Admin) — không gửi email. */
export async function verifySmtpConnection(options: SmtpConnectionOptions): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: options.auth,
  });
  await transporter.verify();
}

export function createResendSender(options: { apiKey: string; from: string }): EmailSender {
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error (${response.status}): ${body}`);
      }
    },
  };
}

export interface EmailEnv {
  EMAIL_PROVIDER: "smtp" | "resend";
  EMAIL_FROM: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  RESEND_API_KEY?: string;
}

export function createEmailSenderFromEnv(env: EmailEnv): EmailSender {
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    return createResendSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    throw new Error("SMTP_HOST and SMTP_PORT are required when EMAIL_PROVIDER=smtp");
  }
  return createSmtpSender({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.EMAIL_FROM });
}
