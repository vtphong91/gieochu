import type { RenderedEmail } from "./verify-email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface GuestActivationTemplateData {
  appName: string;
  /** Link trang "Kích hoạt tài khoản và đặt mật khẩu" (token một lần). */
  activateUrl: string;
  expiresInDays: number;
  /** Mã đơn vừa đặt (nếu email gửi ngay sau khi mua) — để khách nhận ra email. */
  orderCode?: string | null;
}

/**
 * ADR-061 Q1 — "Kích hoạt tài khoản và đặt mật khẩu" cho tài khoản tạo lúc mua không cần đăng ký. KHÔNG chứa mật khẩu; một liên
 * kết dùng một lần vừa xác minh email vừa đặt mật khẩu. Tiêu đề chỉ có tên nền tảng.
 */
export function renderGuestActivationEmail(data: GuestActivationTemplateData): RenderedEmail {
  const subject = `Kích hoạt tài khoản ${data.appName} và đặt mật khẩu`;
  const orderLine = data.orderCode ? `Bạn vừa đặt đơn ${data.orderCode} — tài khoản ${data.appName} đã được tạo với email này.` : `Tài khoản ${data.appName} đã được tạo với email này.`;
  const text = [
    "Chào bạn,",
    "",
    orderLine,
    `Để đăng nhập lại và tải tài liệu trên thiết bị khác, hãy kích hoạt tài khoản và đặt mật khẩu (liên kết dùng một lần, hết hạn sau ${data.expiresInDays} ngày):`,
    data.activateUrl,
    "",
    "Nếu bạn không thực hiện việc này, hãy bỏ qua email.",
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(orderLine)}</p>
    <p>Để đăng nhập lại và tải tài liệu trên thiết bị khác, hãy kích hoạt tài khoản và đặt mật khẩu (liên kết dùng một lần, hết hạn sau ${data.expiresInDays} ngày):</p>
    <p><a href="${escapeHtml(data.activateUrl)}">Kích hoạt tài khoản và đặt mật khẩu</a></p>
    <p>Nếu bạn không thực hiện việc này, hãy bỏ qua email.</p>
  `.trim();
  return { subject, html, text };
}
