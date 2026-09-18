import type { RenderedEmail } from "./verify-email";

export interface NewSaleTemplateData {
  appName: string;
  orderCode: string;
  productTitle: string;
  /** Already formatted VND by the caller — templates don't own currency formatting. */
  totalVndDisplay: string;
  orderUrl: string;
}

/** §"M8": sent to the tenant owner once `markOrderPaid()` fulfills an order for one of their products. */
export function renderNewSaleEmail(data: NewSaleTemplateData): RenderedEmail {
  const subject = `Đơn hàng mới: ${data.productTitle}`;
  const text = [
    "Chào bạn,",
    "",
    `Bạn vừa có đơn hàng mới ${data.orderCode} cho "${data.productTitle}" (${data.totalVndDisplay}).`,
    "",
    `Xem chi tiết đơn hàng: ${data.orderUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Bạn vừa có đơn hàng mới <strong>${data.orderCode}</strong> cho <strong>${data.productTitle}</strong> (${data.totalVndDisplay}).</p>
    <p><a href="${data.orderUrl}">${data.orderUrl}</a></p>
  `.trim();
  return { subject, html, text };
}
