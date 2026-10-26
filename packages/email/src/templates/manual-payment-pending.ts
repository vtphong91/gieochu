import type { RenderedEmail } from "./verify-email";

/** Tên tài liệu/gian hàng/gói do người dùng nhập — luôn escape trước khi đưa vào HTML (cùng quy ước new-review). */
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

export interface OrderAwaitingManualConfirmTemplateData {
  orderCode: string;
  productTitle: string;
  /** Already formatted VND by the caller — templates don't own currency formatting. */
  totalVndDisplay: string;
  /** Hết hạn thanh toán của đơn, đã định dạng giờ Việt Nam. */
  expiresAtDisplay: string;
  /** Mốc cuối còn xác nhận tay được (hết hạn + cửa sổ trễ), đã định dạng giờ Việt Nam. */
  confirmDeadlineDisplay: string;
  /** Link Studio tới chi tiết đơn. */
  orderUrl: string;
}

/**
 * ADR-059 mục 3: báo chủ gian hàng có đơn chuyển khoản cần đối chiếu sao kê và xác nhận tay. Tiêu đề chỉ có mã đơn
 * (không có thông tin khách).
 */
export function renderOrderAwaitingManualConfirmEmail(data: OrderAwaitingManualConfirmTemplateData): RenderedEmail {
  const productTitle = singleLine(data.productTitle);
  const subject = `Đơn ${data.orderCode} chờ bạn xác nhận chuyển khoản`;
  const text = [
    "Chào bạn,",
    "",
    `Khách vừa chọn chuyển khoản cho đơn ${data.orderCode} — "${productTitle}" (${data.totalVndDisplay}).`,
    `Nội dung chuyển khoản là mã đơn ${data.orderCode}. Khi tiền về tài khoản, hãy đối chiếu sao kê rồi bấm "Xác nhận đã nhận tiền" để khách nhận tài liệu.`,
    "",
    `Hạn thanh toán của đơn: ${data.expiresAtDisplay}.`,
    `Bạn có thể xác nhận tay chậm nhất đến: ${data.confirmDeadlineDisplay}.`,
    "",
    `Xem và xác nhận đơn: ${data.orderUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Khách vừa chọn chuyển khoản cho đơn <strong>${escapeHtml(data.orderCode)}</strong> — <strong>${escapeHtml(productTitle)}</strong> (${escapeHtml(data.totalVndDisplay)}).</p>
    <p>Nội dung chuyển khoản là mã đơn <strong>${escapeHtml(data.orderCode)}</strong>. Khi tiền về tài khoản, hãy đối chiếu sao kê rồi bấm “Xác nhận đã nhận tiền” để khách nhận tài liệu.</p>
    <ul>
      <li>Hạn thanh toán của đơn: ${escapeHtml(data.expiresAtDisplay)}</li>
      <li>Xác nhận tay chậm nhất đến: <strong>${escapeHtml(data.confirmDeadlineDisplay)}</strong></li>
    </ul>
    <p><a href="${escapeHtml(data.orderUrl)}">Xem và xác nhận đơn</a></p>
  `.trim();
  return { subject, html, text };
}

export interface InvoiceAwaitingReconciliationTemplateData {
  invoiceCode: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  /** Already formatted VND by the caller. */
  amountVndDisplay: string;
  /** Hạn thanh toán của hoá đơn, đã định dạng giờ Việt Nam. */
  dueAtDisplay: string;
  /** Link `/admin/billing/invoices`. */
  invoicesUrl: string;
  /** Cách thanh toán hiển thị, vd "chuyển khoản QR thủ công" (mặc định) / "chuyển tiền MoMo (xác nhận tay)". */
  methodLabel?: string;
}

/** ADR-059 mục 3: báo System Admin (địa chỉ "Email hỗ trợ") có hoá đơn gói QR thủ công chờ đối soát. Dữ liệu L1. */
export function renderInvoiceAwaitingReconciliationEmail(data: InvoiceAwaitingReconciliationTemplateData): RenderedEmail {
  const tenantName = singleLine(data.tenantName);
  const planName = singleLine(data.planName);
  const subject = `Hoá đơn gói ${data.invoiceCode} chờ đối soát`;
  const method = singleLine(data.methodLabel ?? "chuyển khoản QR thủ công");
  const text = [
    "Chào bạn,",
    "",
    `Gian hàng "${tenantName}" (/${data.tenantSlug}) vừa tạo hoá đơn gói ${data.invoiceCode} thanh toán bằng ${method}.`,
    `Gói: ${planName} — số tiền: ${data.amountVndDisplay}.`,
    `Hạn thanh toán: ${data.dueAtDisplay}.`,
    "",
    `Đối chiếu sao kê theo nội dung chuyển khoản (= mã hoá đơn) rồi xác nhận tại: ${data.invoicesUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Gian hàng <strong>${escapeHtml(tenantName)}</strong> (/${escapeHtml(data.tenantSlug)}) vừa tạo hoá đơn gói <strong>${escapeHtml(data.invoiceCode)}</strong> thanh toán bằng ${escapeHtml(method)}.</p>
    <ul>
      <li>Gói: ${escapeHtml(planName)}</li>
      <li>Số tiền: <strong>${escapeHtml(data.amountVndDisplay)}</strong></li>
      <li>Hạn thanh toán: ${escapeHtml(data.dueAtDisplay)}</li>
    </ul>
    <p>Đối chiếu sao kê theo nội dung chuyển khoản (= mã hoá đơn) rồi xác nhận.</p>
    <p><a href="${escapeHtml(data.invoicesUrl)}">Mở danh sách hoá đơn chờ đối soát</a></p>
  `.trim();
  return { subject, html, text };
}

export interface PaymentAmountMismatchTemplateData {
  orderCode: string;
  /** Already formatted VND by the caller. */
  receivedVndDisplay: string;
  expectedVndDisplay: string;
  /** "thiếu 10.000đ" / "thừa 10.000đ" — caller tính. */
  differenceDisplay: string;
  /** Tên cổng hiển thị (vd "SePay"). */
  providerLabel: string;
  /** Link Studio tới chi tiết đơn. */
  orderUrl: string;
  /** Link Studio tới danh sách "Giao dịch cần xử lý". */
  transactionsUrl: string;
}

/**
 * ADR-059 bổ sung lần 2 (d): báo chủ gian hàng có giao dịch chuyển khoản khớp mã đơn nhưng SAI SỐ TIỀN — đơn không tự giao, chủ
 * gian hàng đối chiếu rồi xác nhận tay (hoặc liên hệ khách). Tiêu đề chỉ có mã đơn.
 */
export function renderPaymentAmountMismatchEmail(data: PaymentAmountMismatchTemplateData): RenderedEmail {
  const subject = `Đơn ${data.orderCode}: giao dịch ${data.providerLabel} sai số tiền`;
  const text = [
    "Chào bạn,",
    "",
    `${data.providerLabel} vừa báo một giao dịch cho đơn ${data.orderCode} nhưng số tiền không khớp: nhận ${data.receivedVndDisplay}, đơn cần ${data.expectedVndDisplay} (${data.differenceDisplay}).`,
    "Đơn chưa được giao tự động. Hãy đối chiếu sao kê, liên hệ khách nếu cần, rồi xác nhận tay hoặc hoàn phần chênh lệch.",
    "",
    `Xem đơn: ${data.orderUrl}`,
    `Giao dịch cần xử lý: ${data.transactionsUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(data.providerLabel)} vừa báo một giao dịch cho đơn <strong>${escapeHtml(data.orderCode)}</strong> nhưng số tiền không khớp:</p>
    <ul>
      <li>Nhận: <strong>${escapeHtml(data.receivedVndDisplay)}</strong></li>
      <li>Đơn cần: ${escapeHtml(data.expectedVndDisplay)} (${escapeHtml(data.differenceDisplay)})</li>
    </ul>
    <p>Đơn chưa được giao tự động. Hãy đối chiếu sao kê, liên hệ khách nếu cần, rồi xác nhận tay hoặc hoàn phần chênh lệch.</p>
    <p><a href="${escapeHtml(data.orderUrl)}">Xem đơn</a> · <a href="${escapeHtml(data.transactionsUrl)}">Giao dịch cần xử lý</a></p>
  `.trim();
  return { subject, html, text };
}
