import type { RenderedEmail } from "./verify-email";

export interface OrderPaidTemplateData {
  appName: string;
  orderCode: string;
  /** Already formatted VND by the caller (e.g. "150.000 đ" — ADR-070) — templates don't own currency formatting. */
  totalVndDisplay: string;
  downloadsUrl: string;
}

/**
 * §"M8": sent to the buyer once `markOrderPaid()` fulfills the order — tells them where to download.
 * ADR-061 Q12 / ADR-062 Q7: nút "Tải tài liệu" trỏ THƯ VIỆN (bắt buộc đăng nhập) — không bao giờ link tải trực tiếp/presigned
 * (quy tắc bảo mật 6).
 */
export function renderOrderPaidEmail(data: OrderPaidTemplateData): RenderedEmail {
  const subject = `Đơn hàng ${data.orderCode} đã thanh toán thành công`;
  const text = [
    "Chào bạn,",
    "",
    `Đơn hàng ${data.orderCode} (${data.totalVndDisplay}) đã thanh toán thành công.`,
    "Tài liệu đã sẵn sàng để tải về.",
    "",
    `Tải tài liệu: ${data.downloadsUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Đơn hàng <strong>${data.orderCode}</strong> (${data.totalVndDisplay}) đã thanh toán thành công. Tài liệu đã sẵn sàng để tải về.</p>
    <p><a href="${data.downloadsUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0F3B82;color:#ffffff;text-decoration:none;font-weight:600">Tải tài liệu</a></p>
    <p style="font-size:12px;color:#4B5563">Nút mở Thư viện tài liệu trong tài khoản của bạn (cần đăng nhập). Không mở được? Dán liên kết: ${data.downloadsUrl}</p>
  `.trim();
  return { subject, html, text };
}
