import { getPrismaClient } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import { AppError, logger } from "@gieochu/core";
import { createEmailSenderFromEnv, createSmtpSender, type EmailEnv, type EmailMessage, type EmailSender } from "@gieochu/email";
import { getDecryptedSystemSmtpConfig } from "./system-smtp";

/**
 * Email gửi tới khách hàng cuối của tenant — System Admin không được đọc chi
 * tiết đơn hàng/khách hàng của tenant (CLAUDE.md §7.9), nên các loại này không
 * bao giờ được ghi vào EmailSendLog (bảng chỉ System Admin đọc), dù việc gửi
 * vẫn diễn ra bình thường. `storefront_message` (ADR-023): báo chủ tenant có
 * lời nhắn từ khách của họ — cùng lý do, không để lộ dấu vết liên hệ lên log.
 * `review_new` (ADR-029): báo chủ tenant có đánh giá mới từ khách của họ — cùng lý do.
 */
const TENANT_CUSTOMER_FACING_TYPES = new Set(["order_paid", "new_sale", "storefront_message", "review_new"]);

export const EMAIL_NOT_CONFIGURED = "EMAIL_NOT_CONFIGURED";

/** Chưa có cả cấu hình SMTP ở System Center lẫn fallback env — báo lỗi nghiệp vụ tiếng Việt, không throw lỗi kỹ thuật. */
export function emailNotConfiguredError(): AppError {
  return new AppError({
    code: EMAIL_NOT_CONFIGURED,
    message: "Chưa cấu hình máy chủ email — vào System Center › Cài đặt › SMTP để thiết lập.",
    httpStatus: 503,
  });
}

/**
 * Sender thật dùng khi gửi email — ưu tiên cấu hình SMTP đã lưu ở System Center
 * (/admin/settings/smtp) nếu đang bật + đã xác minh; env chỉ là fallback cho dev
 * (Mailpit) khi đủ biến. Trả `null` nếu không có nguồn nào. Gọi lại mỗi lần
 * gửi (không cache) để admin đổi cấu hình có hiệu lực ngay, không cần khởi
 * động lại worker.
 */
export async function getConfiguredEmailSender(env: EmailEnv): Promise<EmailSender | null> {
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
  /** Mã lỗi nghiệp vụ khi biết rõ nguyên nhân (vd `EMAIL_NOT_CONFIGURED`). */
  code?: string;
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
  let sender: EmailSender | null;
  try {
    // Đọc + giải mã SystemSmtpConfig có thể lỗi (DB, khoá giải mã sai) — không throw lên người gọi
    // (đăng ký/đơn hàng/sweep vẫn phải chạy tiếp), trả `{ ok:false }` + log như mọi lỗi gửi khác.
    sender = await getConfiguredEmailSender(env);
  } catch (error) {
    // Không trả/ghi message kỹ thuật (có thể chứa chi tiết kết nối DB) — chi tiết chỉ nằm trong log server.
    const errorMessage = "Không đọc được cấu hình máy chủ email.";
    logger.error({ err: error, type: message.type }, "email: không đọc được cấu hình máy chủ email");
    await safeLogEmailSend({ type: message.type, recipient: message.to, subject: message.subject, status: "FAILED", errorMessage });
    return { ok: false, error: errorMessage };
  }
  if (!sender) {
    const error = emailNotConfiguredError();
    logger.warn({ type: message.type, code: error.code }, "email: chưa cấu hình máy chủ email, bỏ qua gửi");
    await logEmailSend({ type: message.type, recipient: message.to, subject: message.subject, status: "FAILED", errorMessage: error.message });
    return { ok: false, error: error.message, code: error.code };
  }
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

/** Ghi log gửi mà không để lỗi ghi log (vd DB đang lỗi) làm hỏng luồng của người gọi. */
async function safeLogEmailSend(entry: EmailSendLogEntry): Promise<void> {
  try {
    await logEmailSend(entry);
  } catch (error) {
    logger.error({ err: error, type: entry.type }, "email: ghi email_send_log thất bại");
  }
}
