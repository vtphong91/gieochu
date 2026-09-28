import type { RenderedEmail } from "./verify-email";

export interface StorefrontMessageTemplateData {
  tenantName: string;
  senderName: string;
  senderEmail: string;
  message: string;
  /** Link tới Studio → Hộp thư. */
  inboxUrl: string;
}

/** Mọi field ở đây do khách ẩn danh nhập — luôn escape trước khi đưa vào HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bỏ ký tự xuống dòng — chống chèn header/tiêu đề nhiều dòng từ input khách. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * ADR-023: báo chủ tenant có tin nhắn mới từ form liên hệ trên storefront.
 * Tiêu đề không chứa nội dung khách nhập (chỉ tên trang) để tránh lộ dữ liệu
 * cá nhân ở những nơi chỉ ghi tiêu đề (log gửi email...).
 */
export function renderStorefrontMessageEmail(data: StorefrontMessageTemplateData): RenderedEmail {
  const tenantName = singleLine(data.tenantName);
  const senderName = singleLine(data.senderName);
  const senderEmail = singleLine(data.senderEmail);
  const subject = `Tin nhắn mới từ trang ${tenantName}`;
  const text = [
    "Chào bạn,",
    "",
    `Trang ${tenantName} vừa nhận được một lời nhắn mới.`,
    "",
    `Người gửi: ${senderName} <${senderEmail}>`,
    "",
    data.message,
    "",
    `Xem và quản lý trong Hộp thư: ${data.inboxUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Trang <strong>${escapeHtml(tenantName)}</strong> vừa nhận được một lời nhắn mới.</p>
    <p><strong>Người gửi:</strong> ${escapeHtml(senderName)} &lt;${escapeHtml(senderEmail)}&gt;</p>
    <blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d1d5db;white-space:pre-wrap">${escapeHtml(data.message)}</blockquote>
    <p><a href="${escapeHtml(data.inboxUrl)}">Mở Hộp thư</a></p>
  `.trim();
  return { subject, html, text };
}
