import type { RenderedEmail } from "./verify-email";

/** Nội dung do người dùng nhập (tên tài liệu, tên chủ tài khoản…) — luôn escape trước khi đưa vào HTML. */
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

export interface OrderPaymentInstructionsTemplateData {
  orderCode: string;
  productTitle: string;
  /** Already formatted VND by the caller. */
  totalVndDisplay: string;
  /** Hạn giữ đơn, đã định dạng giờ Việt Nam. */
  expiresAtDisplay: string;
  /** Phương thức khách đã chọn, vd "Chuyển khoản ngân hàng", "Ví MoMo (thủ công)". */
  methodLabel: string;
  /** Thông tin chuyển tiền dạng chữ (ngân hàng/số TK/tên/nội dung…). Rỗng = chỉ có nút về trang thanh toán (cổng chuyển hướng). */
  lines: { label: string; value: string }[];
  /** Link trang thanh toán của đơn. */
  checkoutUrl: string;
  /** `true` = email nhắc (còn ≤ 24 giờ). */
  reminder?: boolean;
  /** Cổng xác nhận tay: nhắc khách bấm "Tôi đã chuyển khoản" sau khi chuyển. */
  manualConfirm?: boolean;
}

/**
 * ADR-061 Q7 — email cho KHÁCH (L3): lúc chọn phương thức và 1 lần nhắc trước hạn. Thông tin chuyển khoản là dữ liệu đã công
 * khai cho chính khách ở trang thanh toán (không secret); không nhúng ảnh QR — khách mở trang thanh toán để quét.
 * Tiêu đề chỉ có mã đơn.
 */
export function renderOrderPaymentInstructionsEmail(data: OrderPaymentInstructionsTemplateData): RenderedEmail {
  const productTitle = singleLine(data.productTitle);
  const subject = data.reminder
    ? `Nhắc thanh toán đơn ${data.orderCode} — hết hạn ${data.expiresAtDisplay}`
    : `Thông tin thanh toán đơn ${data.orderCode}`;
  const intro = data.reminder
    ? `Đơn ${data.orderCode} — "${productTitle}" (${data.totalVndDisplay}) chưa được thanh toán và sẽ hết hạn lúc ${data.expiresAtDisplay}.`
    : `Bạn vừa chọn thanh toán đơn ${data.orderCode} — "${productTitle}" (${data.totalVndDisplay}) bằng ${data.methodLabel}. Đơn được giữ tới ${data.expiresAtDisplay}.`;
  const manualNote = data.manualConfirm
    ? "Sau khi chuyển, mở trang thanh toán và bấm \"Tôi đã chuyển khoản\" để người bán đối chiếu. Nếu đã chuyển rồi, không cần chuyển lại."
    : null;
  const text = [
    "Chào bạn,",
    "",
    intro,
    ...(data.lines.length > 0 ? ["", ...data.lines.map((line) => `${line.label}: ${line.value}`)] : []),
    ...(manualNote ? ["", manualNote] : []),
    "",
    `Mở trang thanh toán: ${data.checkoutUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(intro)}</p>
    ${
      data.lines.length > 0
        ? `<table role="presentation" cellpadding="4" style="border-collapse:collapse">${data.lines
            .map((line) => `<tr><td>${escapeHtml(line.label)}</td><td><strong>${escapeHtml(line.value)}</strong></td></tr>`)
            .join("")}</table>`
        : ""
    }
    ${manualNote ? `<p>${escapeHtml(manualNote)}</p>` : ""}
    <p><a href="${escapeHtml(data.checkoutUrl)}">Mở trang thanh toán</a></p>
  `.trim();
  return { subject, html, text };
}

export interface CustomerDeclaredPaidTemplateData {
  orderCode: string;
  productTitle: string;
  totalVndDisplay: string;
  methodLabel: string;
  declaredAtDisplay: string;
  /** Link Studio tới chi tiết đơn. */
  orderUrl: string;
}

/** ADR-062 Q1 — email NGƯỜI BÁN (L2): "Khách báo đã chuyển đơn {mã}" — một lần/đơn. Tiêu đề chỉ có mã đơn. */
export function renderCustomerDeclaredPaidEmail(data: CustomerDeclaredPaidTemplateData): RenderedEmail {
  const productTitle = singleLine(data.productTitle);
  const subject = `Khách báo đã chuyển đơn ${data.orderCode}`;
  const body = `Khách vừa báo đã chuyển tiền cho đơn ${data.orderCode} — "${productTitle}" (${data.totalVndDisplay}) qua ${data.methodLabel}, lúc ${data.declaredAtDisplay}. Hãy đối chiếu rồi xác nhận đơn để khách nhận tài liệu.`;
  const text = ["Chào bạn,", "", body, "", `Xem và xác nhận đơn: ${data.orderUrl}`].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(body)}</p>
    <p><a href="${escapeHtml(data.orderUrl)}">Xem và xác nhận đơn</a></p>
  `.trim();
  return { subject, html, text };
}
