import type { RenderedEmail } from "./verify-email";

export interface ProductFileRejectedTemplateData {
  appName: string;
  productTitle: string;
  fileName: string;
  productUrl: string;
}

/** §"M5" file.scan job: sent when a file's magic bytes don't match its claimed extension (object already deleted). */
export function renderProductFileRejectedEmail(data: ProductFileRejectedTemplateData): RenderedEmail {
  const subject = `File "${data.fileName}" bị từ chối`;
  const text = [
    "Chào bạn,",
    "",
    `File "${data.fileName}" bạn tải lên cho sản phẩm "${data.productTitle}" không đúng định dạng đã khai báo`,
    "nên đã bị từ chối và xoá khỏi hệ thống.",
    "",
    `Vào sản phẩm để tải lại file: ${data.productUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>File <strong>${data.fileName}</strong> bạn tải lên cho sản phẩm <strong>${data.productTitle}</strong> không đúng định dạng đã khai báo nên đã bị từ chối và xoá khỏi hệ thống.</p>
    <p><a href="${data.productUrl}">${data.productUrl}</a></p>
  `.trim();
  return { subject, html, text };
}
