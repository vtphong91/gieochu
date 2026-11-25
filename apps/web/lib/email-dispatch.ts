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
 * `entitlement_remedy_customer` (ADR-039): báo từng khách đã mua tài liệu bị gỡ — log sẽ thành danh sách khách của
 * tenant. `remedy_refund_requested` (ADR-039): báo chủ tenant 1 khách yêu cầu hoàn tiền (kèm mã đơn) — cùng lý do.
 * (Email tổng hợp cho chủ tenant `entitlement_remedy_tenant` vẫn ghi log: tiêu đề không chứa dữ liệu khách.)
 * `order_pending_manual` (ADR-059): báo chủ tenant có đơn chuyển khoản chờ xác nhận tay — tiêu đề có mã đơn, log sẽ thành
 * danh sách đơn của tenant. `payment_mismatch` (ADR-059 bổ sung lần 2): báo chủ tenant giao dịch sai tiền cho 1 đơn — cùng lý do.
 * (Email `invoice_pending_manual` báo admin có hoá đơn gói chờ đối soát là dữ liệu L1 — vẫn ghi log.)
 */
const TENANT_CUSTOMER_FACING_TYPES = new Set([
  "order_paid",
  "new_sale",
  "storefront_message",
  "review_new",
  "entitlement_remedy_customer",
  "remedy_refund_requested",
  "order_pending_manual",
  "payment_mismatch",
  // ADR-061/062: email cho khách (hướng dẫn thanh toán, nhắc) và email người bán "khách báo đã chuyển" — đều có mã đơn.
  "order_payment_customer",
  "order_payment_reminder",
  "order_customer_declared_paid",
  // ADR-070: email cho khách khi đơn hết hạn / sai số tiền / MoMo thất bại / người bán huỷ — có mã đơn.
  "order_expired_customer",
  "order_amount_mismatch_customer",
  "order_payment_failed_customer",
  "order_canceled_customer",
]);

export const EMAIL_NOT_CONFIGURED = "EMAIL_NOT_CONFIGURED";

/**
 * ADR-059: lên lịch một việc (thường là gửi email báo) chạy SAU khi response đã gửi — Server Action truyền `after` của
 * `next/server`. Hàm lib nhận tham số này thay vì tự gọi `after()` để test/script không vô tình gửi email.
 */
export type ScheduleAfterResponse = (task: () => Promise<void>) => void;

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
