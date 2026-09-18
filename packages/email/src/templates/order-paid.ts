import type { RenderedEmail } from "./verify-email";

export interface OrderPaidTemplateData {
  appName: string;
  orderCode: string;
  /** Already formatted VND by the caller (e.g. "150.000đ") — templates don't own currency formatting. */
  totalVndDisplay: string;
  downloadsUrl: string;
}

/** §"M8": sent to the buyer once `markOrderPaid()` fulfills the order — tells them where to download. */
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
    <p><a href="${data.downloadsUrl}">${data.downloadsUrl}</a></p>
  `.trim();
  return { subject, html, text };
}
