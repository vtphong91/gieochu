import type { RenderedEmail } from "./verify-email";

/**
 * ADR-070 — email thông báo trạng thái thanh toán (câu chữ đã qua soát của Phong, Quốc duyệt):
 * - {@link renderSubscriptionInvoiceEmail} — hoá đơn gói dịch vụ (L1), gửi CHỦ GIAN HÀNG: A1 thành công, A2 hết hạn, A3 sai số tiền,
 *   A4 MoMo thất bại, A5 quản trị viên huỷ. Liên hệ = "Email hỗ trợ" trong System Settings (`mailto:`).
 * - {@link renderOrderStatusEmail} — đơn tài liệu (L3), gửi KHÁCH của đơn: B2 hết hạn, B3 sai số tiền, B4 MoMo thất bại, B5 người bán
 *   huỷ. Liên hệ = trang gian hàng của người bán (có gửi tin nhắn).
 * Quy ước: tên thương hiệu nhận qua `appName` (không hard-code); tiền/ngày do NƠI GỌI định dạng ("150.000 đ", dd/mm/yyyy theo giờ
 * Việt Nam); mọi chuỗi do người dùng nhập (tên gian hàng, gói, tài liệu) được escape trong HTML và bọc ngoặc kép cong “…”; tiêu đề chỉ
 * có mã hoá đơn/mã đơn hàng (+ tên gói). KHÔNG chứa ghi chú nội bộ của admin/người bán.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Kiểu nút giống `order-paid.ts`. */
const BUTTON_STYLE = "display:inline-block;padding:10px 18px;border-radius:8px;background:#0F3B82;color:#ffffff;text-decoration:none;font-weight:600";
const HINT_STYLE = "font-size:12px;color:#4B5563";

interface EmailParts {
  subject: string;
  lines: string[];
  /** `textValue`: thay `url` trong bản chữ thuần (vd địa chỉ email thay cho `mailto:`). */
  action: { label: string; url: string; textValue?: string };
  /** Dòng liên hệ: bản chữ thuần + bản HTML (đã escape, có thể chứa liên kết). */
  contact: { text: string; html: string };
  /** Chữ ký (các dòng). */
  signature: string[];
}

function renderParts(parts: EmailParts): RenderedEmail {
  const isMailto = parts.action.url.startsWith("mailto:");
  const text = [
    "Chào bạn,",
    "",
    ...parts.lines.flatMap((line) => [line, ""]),
    `${parts.action.label}: ${parts.action.textValue ?? parts.action.url}`,
    "",
    parts.contact.text,
    "",
    ...parts.signature,
  ].join("\n");
  const url = escapeHtml(parts.action.url);
  const html = `
    <p>Chào bạn,</p>
    ${parts.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n    ")}
    <p><a href="${url}" style="${BUTTON_STYLE}">${escapeHtml(parts.action.label)}</a></p>
    ${isMailto ? "" : `<p style="${HINT_STYLE}">Không bấm được? Dán liên kết: ${url}</p>`}
    <p>${parts.contact.html}</p>
    <p>${parts.signature.map(escapeHtml).join("<br>")}</p>
  `.trim();
  return { subject: parts.subject, html, text };
}

function quoted(value: string): string {
  return `“${singleLine(value)}”`;
}

// ───────────────────────── Hoá đơn gói dịch vụ (chủ gian hàng) ─────────────────────────

export type SubscriptionInvoiceEmailStage = "PAID" | "EXPIRED" | "AMOUNT_MISMATCH" | "PAYMENT_FAILED" | "VOIDED";

export interface SubscriptionInvoiceEmailData {
  appName: string;
  tenantName: string;
  invoiceCode: string;
  planName: string;
  /** Số tiền hoá đơn, đã định dạng ("150.000 đ"). */
  amountVndDisplay: string;
  /** Cổng thanh toán, vd "chuyển khoản ngân hàng (QR)", "ví MoMo". */
  providerLabel: string;
  /** Trang Gói dịch vụ của gian hàng (`/studio/{slug}/billing`). */
  billingUrl: string;
  /** "Email hỗ trợ" trong System Settings — null khi chưa đặt. */
  supportEmail: string | null;
  /** PAID: kỳ gói mới (dd/mm/yyyy, giờ Việt Nam). */
  periodStartDisplay?: string;
  periodEndDisplay?: string;
  /** AMOUNT_MISMATCH: số tiền thực nhận, mô tả chênh lệch ("thiếu 10.000 đ") và loại chênh. */
  receivedVndDisplay?: string;
  differenceDisplay?: string;
  differenceKind?: "SHORT" | "OVER";
}

export function renderSubscriptionInvoiceEmail(stage: SubscriptionInvoiceEmailStage, data: SubscriptionInvoiceEmailData): RenderedEmail {
  const tenant = quoted(data.tenantName);
  const plan = quoted(data.planName);
  const planPlain = singleLine(data.planName);
  const invoiceRef = `Hoá đơn ${data.invoiceCode} (gói ${plan}, ${data.amountVndDisplay})`;
  const support = data.supportEmail;
  const contact = support
    ? { text: `Cần hỗ trợ? Liên hệ ${support}.`, html: `Cần hỗ trợ? Liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.` }
    : {
        text: `Cần hỗ trợ? Liên hệ bộ phận hỗ trợ của ${data.appName}.`,
        html: `Cần hỗ trợ? Liên hệ bộ phận hỗ trợ của ${escapeHtml(data.appName)}.`,
      };
  const base = { contact, signature: ["Trân trọng,", data.appName] };
  const billingAction = { label: "Xem gói dịch vụ", url: data.billingUrl };

  switch (stage) {
    case "PAID":
      return renderParts({
        ...base,
        subject: `Thanh toán thành công hoá đơn ${data.invoiceCode} — gói ${planPlain}`,
        lines: [
          `${invoiceRef} của gian hàng ${tenant} đã được thanh toán thành công qua ${data.providerLabel}.`,
          ...(data.periodStartDisplay && data.periodEndDisplay
            ? [`Gói dịch vụ có hiệu lực từ ${data.periodStartDisplay} đến ${data.periodEndDisplay}.`]
            : []),
        ],
        action: billingAction,
      });
    case "EXPIRED":
      return renderParts({
        ...base,
        subject: `Hoá đơn gói dịch vụ ${data.invoiceCode} đã hết hạn thanh toán`,
        lines: [
          `${invoiceRef} của gian hàng ${tenant} đã hết hạn mà hệ thống chưa nhận được thanh toán.`,
          "Nếu bạn đã chuyển tiền cho hoá đơn này, đừng chuyển lại — hãy liên hệ hỗ trợ để được đối soát.",
          "Nếu vẫn muốn dùng gói này, bạn có thể gia hạn trong trang Gói dịch vụ (mục “Gia hạn / Nâng cấp”).",
        ],
        action: { label: "Gia hạn gói dịch vụ", url: data.billingUrl },
      });
    case "AMOUNT_MISMATCH":
      return renderParts({
        ...base,
        subject: `Hoá đơn ${data.invoiceCode}: số tiền nhận được không khớp`,
        lines: [
          `Hệ thống nhận được ${data.receivedVndDisplay ?? "một khoản tiền"} qua ${data.providerLabel} cho hoá đơn ${data.invoiceCode} (gói ${plan}) của gian hàng ${tenant}, nhưng số tiền cần thanh toán là ${data.amountVndDisplay}${data.differenceDisplay ? ` (${data.differenceDisplay})` : ""}.`,
          data.differenceKind === "OVER"
            ? `Hoá đơn chưa được ghi nhận tự động vì số tiền không khớp. Hãy liên hệ hỗ trợ, gửi kèm mã hoá đơn ${data.invoiceCode} và ảnh chụp giao dịch — bộ phận hỗ trợ sẽ đối soát và hướng dẫn xử lý phần chênh lệch.`
            : `Hoá đơn chưa được ghi nhận thanh toán. Vui lòng không chuyển bù phần thiếu — hãy liên hệ hỗ trợ, gửi kèm mã hoá đơn ${data.invoiceCode} và ảnh chụp giao dịch để được đối soát.`,
        ],
        action: support
          ? {
              label: "Liên hệ hỗ trợ",
              url: `mailto:${support}?subject=${encodeURIComponent(`Đối soát hoá đơn ${data.invoiceCode}`)}`,
              textValue: `${support} (tiêu đề: Đối soát hoá đơn ${data.invoiceCode})`,
            }
          : billingAction,
      });
    case "PAYMENT_FAILED":
      return renderParts({
        ...base,
        subject: `Thanh toán hoá đơn ${data.invoiceCode} qua ${data.providerLabel} chưa thành công`,
        lines: [
          `Giao dịch ${data.providerLabel} cho hoá đơn ${data.invoiceCode} (gói ${plan}, ${data.amountVndDisplay}) của gian hàng ${tenant} chưa thành công hoặc đã bị huỷ.`,
          "Hoá đơn chưa được thanh toán — bạn có thể thanh toán lại trong trang Gói dịch vụ.",
          `Nếu ví MoMo của bạn đã bị trừ tiền, đừng thanh toán lại — hãy liên hệ hỗ trợ kèm mã hoá đơn ${data.invoiceCode}.`,
        ],
        action: { label: "Thanh toán lại", url: data.billingUrl },
      });
    case "VOIDED":
      return renderParts({
        ...base,
        subject: `Hoá đơn ${data.invoiceCode} đã bị huỷ`,
        lines: [
          `${invoiceRef} của gian hàng ${tenant} đã bị quản trị viên ${data.appName} huỷ. Gói dịch vụ hiện tại của gian hàng không thay đổi.`,
          "Nếu bạn đã chuyển tiền cho hoá đơn này, hãy liên hệ hỗ trợ. Nếu cần, bạn có thể gia hạn lại trong trang Gói dịch vụ.",
        ],
        action: billingAction,
      });
  }
}

// ───────────────────────── Đơn tài liệu (khách) ─────────────────────────

export type OrderStatusEmailStage = "EXPIRED" | "AMOUNT_MISMATCH" | "PAYMENT_FAILED" | "CANCELED_BY_SELLER";

export interface OrderStatusEmailData {
  appName: string;
  /** Tên gian hàng (người bán). */
  tenantName: string;
  orderCode: string;
  /** Tên tài liệu đầu tiên của đơn. */
  productTitle: string;
  /** Số tài liệu khác trong đơn (0 = đơn một tài liệu). */
  extraItemCount: number;
  /** Tổng tiền đơn, đã định dạng ("150.000 đ"). */
  totalVndDisplay: string;
  /** Trang gian hàng — nơi khách liên hệ người bán. */
  storefrontUrl: string;
  /**
   * EXPIRED: trang tài liệu (mua lại) — bỏ trống khi tài liệu ngừng bán (nút "Xem trang gian hàng"). PAYMENT_FAILED: trang thanh
   * toán của đơn.
   */
  actionUrl?: string;
  /** AMOUNT_MISMATCH / PAYMENT_FAILED. */
  providerLabel?: string;
  receivedVndDisplay?: string;
  differenceDisplay?: string;
  differenceKind?: "SHORT" | "OVER";
  /** PAYMENT_FAILED: hạn thanh toán lại (theo `expiresAt` của đơn, giờ Việt Nam). */
  holdUntilDisplay?: string;
}

export function renderOrderStatusEmail(stage: OrderStatusEmailStage, data: OrderStatusEmailData): RenderedEmail {
  const tenant = quoted(data.tenantName);
  const title = quoted(data.productTitle);
  const more = data.extraItemCount > 0 ? ` và ${data.extraItemCount} tài liệu khác` : "";
  const orderRef = `Đơn hàng ${data.orderCode} — ${title}${more} (${data.totalVndDisplay})`;
  const storefront = escapeHtml(data.storefrontUrl);
  const contact = {
    text: `Liên hệ người bán ${tenant}: ${data.storefrontUrl}`,
    html: `Liên hệ người bán ${escapeHtml(tenant)}: <a href="${storefront}">${storefront}</a>`,
  };
  const base = { contact, signature: [`${data.appName} — thay mặt ${tenant}`] };
  const contactAction = { label: "Liên hệ người bán", url: data.storefrontUrl };

  switch (stage) {
    case "EXPIRED":
      return renderParts({
        ...base,
        subject: `Đơn hàng ${data.orderCode} đã hết hạn thanh toán`,
        lines: [
          `${orderRef} tại ${tenant} đã hết hạn mà chưa được thanh toán.`,
          "Nếu bạn đã chuyển tiền cho đơn hàng này, đừng chuyển lại — hãy liên hệ người bán.",
          "Nếu vẫn muốn mua, bạn có thể mua lại tài liệu.",
        ],
        action: data.actionUrl
          ? { label: "Mua lại tài liệu", url: data.actionUrl }
          : { label: "Xem trang gian hàng", url: data.storefrontUrl },
      });
    case "AMOUNT_MISMATCH":
      return renderParts({
        ...base,
        subject: `Đơn hàng ${data.orderCode}: số tiền nhận được không khớp`,
        lines: [
          `Người bán nhận được ${data.receivedVndDisplay ?? "một khoản tiền"}${data.providerLabel ? ` qua ${data.providerLabel}` : ""} cho đơn hàng ${data.orderCode} — ${title}${more}, nhưng số tiền cần thanh toán là ${data.totalVndDisplay}${data.differenceDisplay ? ` (${data.differenceDisplay})` : ""}.`,
          data.differenceKind === "OVER"
            ? `Đơn hàng chưa được xác nhận tự động vì số tiền không khớp. Hãy liên hệ người bán, gửi kèm mã đơn ${data.orderCode} và ảnh chụp giao dịch để được xử lý phần chênh lệch.`
            : `Đơn hàng chưa được xác nhận thanh toán. Vui lòng không chuyển bù phần thiếu — hãy liên hệ người bán, gửi kèm mã đơn ${data.orderCode} và ảnh chụp giao dịch.`,
        ],
        action: contactAction,
      });
    case "PAYMENT_FAILED":
      return renderParts({
        ...base,
        subject: `Thanh toán đơn hàng ${data.orderCode} qua ${data.providerLabel ?? "cổng thanh toán"} chưa thành công`,
        lines: [
          `Giao dịch ${data.providerLabel ?? "thanh toán"} cho ${orderRef.charAt(0).toLowerCase()}${orderRef.slice(1)} tại ${tenant} chưa thành công hoặc đã bị huỷ.`,
          data.holdUntilDisplay
            ? `Đơn hàng chưa được thanh toán — bạn có thể thanh toán lại trước ${data.holdUntilDisplay}.`
            : "Đơn hàng chưa được thanh toán — bạn có thể thanh toán lại.",
          `Nếu ví MoMo của bạn đã bị trừ tiền, đừng thanh toán lại — hãy liên hệ người bán kèm mã đơn ${data.orderCode}.`,
        ],
        action: { label: "Thanh toán lại", url: data.actionUrl ?? data.storefrontUrl },
      });
    case "CANCELED_BY_SELLER":
      return renderParts({
        ...base,
        subject: `Đơn hàng ${data.orderCode} đã bị người bán huỷ`,
        lines: [`${orderRef} tại ${tenant} đã bị người bán huỷ.`, "Nếu bạn đã chuyển tiền hoặc cần biết thêm, vui lòng liên hệ người bán."],
        action: contactAction,
      });
  }
}
