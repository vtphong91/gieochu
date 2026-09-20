import { getPrismaClient } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import { createEmailSenderFromEnv, createSmtpSender, type EmailEnv, type EmailMessage, type EmailSender } from "@gieochu/email";
import { getDecryptedSystemSmtpConfig } from "./system-smtp";

/**
 * Email gửi tới khách hàng cuối của tenant — System Admin không được đọc chi
 * tiết đơn hàng/khách hàng của tenant (CLAUDE.md §7.9), nên các loại này không
 * bao giờ được ghi vào EmailSendLog (bảng chỉ System Admin đọc), dù việc gửi
 * vẫn diễn ra bình thường.
 */
const TENANT_CUSTOMER_FACING_TYPES = new Set(["order_paid", "new_sale"]);

/**
 * Sender thật dùng khi gửi email — ưu tiên cấu hình SMTP đã lưu ở System Admin
 * (/admin/settings/smtp) nếu đang bật + đã xác minh, rơi về cấu hình qua env
 * (Mailpit dev / Resend prod) nếu chưa cấu hình hoặc đang tắt. Gọi lại mỗi lần
 * gửi (không cache) để admin đổi cấu hình có hiệu lực ngay, không cần khởi
 * động lại worker.
 */
export async function getConfiguredEmailSender(env: EmailEnv): Promise<EmailSender> {
  const dbConfig = await getDecryptedSystemSmtpConfig();
  if (dbConfig) {
    return createSmtpSender({
      host: dbConfig.host,
      port: dbConfig.port,
      secure: dbConfig.secure,
      auth: { user: dbConfig.username, pass: dbConfig.password },
      from: `${dbConfig.fromName} <${dbConfig.fromEmail}>`,
      replyTo: dbConfig.replyTo || undefined,
    });
  }
  return createEmailSenderFromEnv(env);
}

export interface EmailSendLogEntry {
  type: string;
  recipient: string;
  subject: string;
  status: "SENT" | "FAILED";
  errorMessage?: string;
}

export async function logEmailSend(entry: EmailSendLogEntry): Promise<void> {
  if (TENANT_CUSTOMER_FACING_TYPES.has(entry.type)) return;
  const prisma = getPrismaClient();
  await prisma.emailSendLog.create({
    data: {
      type: entry.type,
      recipient: entry.recipient,
      subject: entry.subject,
      status: entry.status,
      errorMessage: entry.errorMessage ?? null,
    },
  });
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Gửi email THẬT NGAY, đồng bộ trong request/Server Action — không qua hàng
 * đợi + worker riêng nữa (quyết định đổi hướng: hàng đợi từng khiến email
 * "biến mất" âm thầm không dấu vết nếu quên chạy `pnpm worker`, ghi job luôn
 * thành công nên UI không có gì để báo lỗi). Đánh đổi: action phải chờ SMTP
 * xong mới xong (chậm hơn ~1-2s), nhưng thành công/thất bại phản hồi được
 * ngay cho người gọi thay vì im lặng.
 */
export async function sendEmailNow(message: EmailMessage): Promise<SendEmailResult> {
  const env = getEnv();
  const sender = await getConfiguredEmailSender(env);
  try {
    await sender.send(message);
    await logEmailSend({ type: message.type, recipient: message.to, subject: message.subject, status: "SENT" });
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Gửi email thất bại.";
    await logEmailSend({ type: message.type, recipient: message.to, subject: message.subject, status: "FAILED", errorMessage });
    return { ok: false, error: errorMessage };
  }
}
