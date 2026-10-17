import type { RenderedEmail } from "./verify-email";

/**
 * ADR-041 mục C.2 — email bảo mật tài khoản: đổi mật khẩu, đổi email đăng nhập. Mọi chuỗi đưa vào HTML đều escape
 * (tên nền tảng do admin nhập, email do người dùng nhập). Tiêu đề không chứa email để không lộ dữ liệu cá nhân ở log
 * gửi (`email_send_log` chỉ ghi tiêu đề + người nhận).
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

export interface PasswordChangedTemplateData {
  appName: string;
  /** Thời điểm đổi đã định dạng giờ Việt Nam (caller định dạng theo `DISPLAY_TIME_ZONE`). */
  changedAtText: string;
  /** Link `/forgot-password` tuyệt đối. */
  forgotPasswordUrl: string;
}

export function renderPasswordChangedEmail(data: PasswordChangedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const subject = `Mật khẩu ${appName} của bạn vừa được đổi`;
  const text = [
    "Chào bạn,",
    "",
    `Mật khẩu tài khoản ${appName} của bạn vừa được đổi lúc ${data.changedAtText}. Các thiết bị khác đã được đăng xuất.`,
    "",
    "Nếu không phải bạn thực hiện, hãy đặt lại mật khẩu ngay tại:",
    data.forgotPasswordUrl,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Mật khẩu tài khoản <strong>${escapeHtml(appName)}</strong> của bạn vừa được đổi lúc ${escapeHtml(data.changedAtText)}. Các thiết bị khác đã được đăng xuất.</p>
    <p>Nếu không phải bạn thực hiện, hãy đặt lại mật khẩu ngay tại: <a href="${escapeHtml(data.forgotPasswordUrl)}">${escapeHtml(data.forgotPasswordUrl)}</a></p>
  `.trim();
  return { subject, html, text };
}

export interface EmailChangeVerifyTemplateData {
  appName: string;
  /** Link `/account/email/xac-nhan?token=...` tuyệt đối (gửi tới email MỚI). */
  confirmUrl: string;
  /** Hạn link (giờ) — `SystemSettings.emailVerifyTtlHours`. */
  expiresInHours: number;
}

export function renderEmailChangeVerifyEmail(data: EmailChangeVerifyTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const subject = `Xác nhận email đăng nhập mới cho ${appName}`;
  const text = [
    "Chào bạn,",
    "",
    `Có yêu cầu dùng địa chỉ email này làm email đăng nhập tài khoản ${appName}.`,
    `Mở liên kết sau và bấm "Xác nhận đổi email" (liên kết hết hạn sau ${data.expiresInHours} giờ):`,
    data.confirmUrl,
    "",
    "Nếu bạn không yêu cầu, hãy bỏ qua email này — không có gì thay đổi.",
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Có yêu cầu dùng địa chỉ email này làm email đăng nhập tài khoản <strong>${escapeHtml(appName)}</strong>.</p>
    <p>Mở liên kết sau và bấm "Xác nhận đổi email" (liên kết hết hạn sau ${data.expiresInHours} giờ):</p>
    <p><a href="${escapeHtml(data.confirmUrl)}">${escapeHtml(data.confirmUrl)}</a></p>
    <p>Nếu bạn không yêu cầu, hãy bỏ qua email này — không có gì thay đổi.</p>
  `.trim();
  return { subject, html, text };
}

export interface EmailChangeRequestedTemplateData {
  appName: string;
  /** Email mới đã che (`n***@domain`) — không lộ đầy đủ ở hộp thư cũ. */
  maskedNewEmail: string;
  /** Link `/account/security` tuyệt đối (huỷ yêu cầu / đổi mật khẩu). */
  securityUrl: string;
  forgotPasswordUrl: string;
}

/** Gửi tới email CŨ khi có yêu cầu đổi email. */
export function renderEmailChangeRequestedEmail(data: EmailChangeRequestedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const subject = `Có yêu cầu đổi email đăng nhập ${appName}`;
  const text = [
    "Chào bạn,",
    "",
    `Tài khoản ${appName} của bạn vừa có yêu cầu đổi email đăng nhập sang ${data.maskedNewEmail}.`,
    "Email hiện tại vẫn dùng để đăng nhập cho tới khi email mới được xác nhận.",
    "",
    `Nếu không phải bạn, hãy huỷ yêu cầu tại ${data.securityUrl} và đổi mật khẩu ngay (hoặc đặt lại tại ${data.forgotPasswordUrl}).`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Tài khoản <strong>${escapeHtml(appName)}</strong> của bạn vừa có yêu cầu đổi email đăng nhập sang <strong>${escapeHtml(data.maskedNewEmail)}</strong>.</p>
    <p>Email hiện tại vẫn dùng để đăng nhập cho tới khi email mới được xác nhận.</p>
    <p>Nếu không phải bạn, hãy huỷ yêu cầu tại <a href="${escapeHtml(data.securityUrl)}">${escapeHtml(data.securityUrl)}</a> và đổi mật khẩu ngay (hoặc đặt lại tại <a href="${escapeHtml(data.forgotPasswordUrl)}">${escapeHtml(data.forgotPasswordUrl)}</a>).</p>
  `.trim();
  return { subject, html, text };
}

export interface EmailChangedTemplateData {
  appName: string;
  maskedNewEmail: string;
  changedAtText: string;
  /** Email hỗ trợ (nếu admin đã cấu hình) — người dùng mất quyền email cũ cần liên hệ. */
  supportEmail?: string | null;
}

/** Gửi tới email CŨ sau khi đổi email thành công. */
export function renderEmailChangedEmail(data: EmailChangedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const support = data.supportEmail ? singleLine(data.supportEmail) : "";
  const subject = `Email đăng nhập ${appName} đã được đổi`;
  const text = [
    "Chào bạn,",
    "",
    `Email đăng nhập tài khoản ${appName} đã được đổi sang ${data.maskedNewEmail} lúc ${data.changedAtText}. Mọi thiết bị đã được đăng xuất.`,
    "Từ nay địa chỉ này không còn dùng để đăng nhập và không nhận thông báo của tài khoản nữa.",
    "",
    support ? `Nếu không phải bạn thực hiện, hãy liên hệ ngay ${support}.` : "Nếu không phải bạn thực hiện, hãy liên hệ bộ phận hỗ trợ ngay.",
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Email đăng nhập tài khoản <strong>${escapeHtml(appName)}</strong> đã được đổi sang <strong>${escapeHtml(data.maskedNewEmail)}</strong> lúc ${escapeHtml(data.changedAtText)}. Mọi thiết bị đã được đăng xuất.</p>
    <p>Từ nay địa chỉ này không còn dùng để đăng nhập và không nhận thông báo của tài khoản nữa.</p>
    <p>${support ? `Nếu không phải bạn thực hiện, hãy liên hệ ngay <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.` : "Nếu không phải bạn thực hiện, hãy liên hệ bộ phận hỗ trợ ngay."}</p>
  `.trim();
  return { subject, html, text };
}
