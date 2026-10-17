/**
 * ADR-041 B (+ bổ sung) — hoàn tiền gói trả phí: trong 7 ngày kể từ `paidAt`, chỉ hoá đơn PAID ĐẦU TIÊN của mỗi tenant,
 * hoàn 100% (= `amountVnd` của hoá đơn). Chủ gian hàng gửi yêu cầu kèm thông tin nhận tiền (ngân hàng, số tài khoản,
 * tên chủ TK); admin tự chuyển khoản rồi bấm "Đã hoàn" hoặc từ chối kèm lý do.
 *
 * File thuần (không Prisma/không đọc env) — client component dùng được nhãn/giới hạn qua subpath
 * `@gieochu/core/subscription-refund`.
 */

export const SUBSCRIPTION_REFUND_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Khớp enum Postgres `SubscriptionRefundStatus`. */
export const SUBSCRIPTION_REFUND_STATUSES = ["REQUESTED", "APPROVED_REFUNDED", "REJECTED"] as const;
export type SubscriptionRefundStatusValue = (typeof SUBSCRIPTION_REFUND_STATUSES)[number];

export const SUBSCRIPTION_REFUND_STATUS_LABELS: Record<SubscriptionRefundStatusValue, string> = {
  REQUESTED: "Đang chờ xử lý",
  APPROVED_REFUNDED: "Đã hoàn tiền",
  REJECTED: "Bị từ chối",
};

export const SUBSCRIPTION_REFUND_REASON_MAX = 500;
export const SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX = 500;
export const REFUND_PAYOUT_ACCOUNT_NAME_MAX = 100;

export const SUBSCRIPTION_REFUND_ERROR_CODES = {
  NOT_ELIGIBLE: "REFUND_NOT_ELIGIBLE",
  ALREADY_REQUESTED: "REFUND_ALREADY_REQUESTED",
  NOT_PENDING: "REFUND_NOT_PENDING",
  UNAVAILABLE: "REFUND_UNAVAILABLE",
  INVALID_PAYOUT: "REFUND_INVALID_PAYOUT",
  /** Bổ sung ADR-041 lần 2: đã có hoá đơn gói PAID thứ hai → mất quyền yêu cầu / không duyệt "Đã hoàn". */
  LATER_PAYMENT: "REFUND_LATER_PAYMENT_EXISTS",
} as const;

// ───────────────────────── Điều kiện yêu cầu ─────────────────────────

export interface RefundEligibilityInvoice {
  id: string;
  status: string;
  paidAt: Date | null;
  amountVnd: number;
}

export type RefundIneligibleReason =
  | "NO_PAID_INVOICE"
  | "NOT_FIRST_PAYMENT"
  | "WINDOW_EXPIRED"
  | "ALREADY_REQUESTED"
  | "LATER_PAYMENT"
  | "ZERO_AMOUNT";

export type RefundEligibility =
  | { eligible: true; invoiceId: string; amountVnd: number; deadline: Date }
  | { eligible: false; reason: RefundIneligibleReason; deadline: Date | null };

export const REFUND_INELIGIBLE_MESSAGES: Record<RefundIneligibleReason, string> = {
  NO_PAID_INVOICE: "Gian hàng chưa có hoá đơn gói nào đã thanh toán.",
  NOT_FIRST_PAYMENT: "Chỉ lần thanh toán gói đầu tiên của gian hàng được yêu cầu hoàn tiền.",
  WINDOW_EXPIRED: `Đã quá ${SUBSCRIPTION_REFUND_WINDOW_DAYS} ngày kể từ khi thanh toán — không thể yêu cầu hoàn tiền.`,
  ALREADY_REQUESTED: "Gian hàng đã gửi yêu cầu hoàn tiền cho lần thanh toán này.",
  LATER_PAYMENT: "Gian hàng đã thanh toán thêm hoá đơn gói sau lần đầu nên không thể tự yêu cầu hoàn tiền — vui lòng liên hệ hỗ trợ.",
  ZERO_AMOUNT: "Hoá đơn có giá 0đ — không có gì để hoàn.",
};

/** Hạn chót yêu cầu = `paidAt` + 7 ngày (so sánh mốc UTC tuyệt đối, không theo ngày lịch). */
export function refundDeadline(paidAt: Date): Date {
  return new Date(paidAt.getTime() + SUBSCRIPTION_REFUND_WINDOW_DAYS * DAY_MS);
}

/**
 * Quyết định thuần. `firstPaidInvoice` = hoá đơn có `paidAt` sớm nhất của tenant trong số hoá đơn đã từng thanh toán
 * (status PAID hoặc REFUNDED — hoá đơn đã hoàn vẫn tính là "lần đầu", nên không yêu cầu lại được cho hoá đơn sau).
 * `hasAnyRequest` = tenant đã có bất kỳ yêu cầu hoàn tiền gói nào (mọi trạng thái) — mỗi tenant chỉ một lần.
 * `laterPaidInvoiceCount` = số hoá đơn gói PAID khác hoá đơn đầu (bổ sung ADR-041 lần 2: > 0 → mất quyền yêu cầu).
 */
export function evaluateRefundEligibility(input: {
  firstPaidInvoice: RefundEligibilityInvoice | null;
  hasAnyRequest: boolean;
  laterPaidInvoiceCount: number;
  now: Date;
}): RefundEligibility {
  const invoice = input.firstPaidInvoice;
  if (!invoice || !invoice.paidAt) return { eligible: false, reason: "NO_PAID_INVOICE", deadline: null };
  const deadline = refundDeadline(invoice.paidAt);
  if (input.hasAnyRequest) return { eligible: false, reason: "ALREADY_REQUESTED", deadline };
  if (input.laterPaidInvoiceCount > 0) return { eligible: false, reason: "LATER_PAYMENT", deadline };
  if (invoice.status !== "PAID") return { eligible: false, reason: "NOT_FIRST_PAYMENT", deadline };
  if (input.now.getTime() > deadline.getTime()) return { eligible: false, reason: "WINDOW_EXPIRED", deadline };
  if (!Number.isInteger(invoice.amountVnd) || invoice.amountVnd <= 0) return { eligible: false, reason: "ZERO_AMOUNT", deadline };
  return { eligible: true, invoiceId: invoice.id, amountVnd: invoice.amountVnd, deadline };
}

// ───────────────────────── Thông tin nhận tiền ─────────────────────────

/** Dữ liệu cá nhân — chỉ lưu dạng mã hoá AES-256-GCM, không đưa vào audit/log/email (bổ sung ADR-041). */
export interface RefundPayoutDetails {
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

export type RefundPayoutField = "bankBin" | "accountNo" | "accountName";

export type RefundPayoutParseResult =
  | { ok: true; value: { bankBin: string; accountNo: string; accountName: string } }
  | { ok: false; fieldErrors: Partial<Record<RefundPayoutField, string>> };

/** Bỏ dấu + chữ hoa (tên chủ TK ngân hàng VN in hoa không dấu). */
export function normalizeAccountName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate form: `bankBin` 6 chữ số (server kiểm thêm có trong `bank_bins`); số TK 6–19 chữ số (bỏ khoảng trắng/gạch);
 * tên chủ TK 2–100 ký tự sau chuẩn hoá, chỉ chữ cái Latin + khoảng trắng.
 */
export function parseRefundPayoutInput(input: { bankBin: unknown; accountNo: unknown; accountName: unknown }): RefundPayoutParseResult {
  const fieldErrors: Partial<Record<RefundPayoutField, string>> = {};
  const bankBin = typeof input.bankBin === "string" ? input.bankBin.trim() : "";
  if (!/^\d{6}$/.test(bankBin)) fieldErrors.bankBin = "Vui lòng chọn ngân hàng.";

  const accountNo = typeof input.accountNo === "string" ? input.accountNo.replace(/[\s.-]/g, "") : "";
  if (!/^\d{6,19}$/.test(accountNo)) fieldErrors.accountNo = "Số tài khoản gồm 6–19 chữ số.";

  const accountName = typeof input.accountName === "string" ? normalizeAccountName(input.accountName) : "";
  if (accountName.length < 2 || accountName.length > REFUND_PAYOUT_ACCOUNT_NAME_MAX || !/^[A-Z ]+$/.test(accountName)) {
    fieldErrors.accountName = "Tên chủ tài khoản chỉ gồm chữ cái và khoảng trắng (2–100 ký tự).";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { bankBin, accountNo, accountName } };
}

/** Che số tài khoản cho danh sách admin: `••••1234`. */
export function maskAccountNo(accountNo: string): string {
  return `••••${accountNo.slice(-4)}`;
}

/** Chuỗi văn bản tự do (lý do/ghi chú): trim, gộp xuống dòng thừa, cắt `max`; rỗng → null. */
export function normalizeRefundText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length === 0) return null;
  return text.slice(0, max);
}
