import type { RenderedEmail } from "./verify-email";

/** Nội dung do quản trị viên nhập — luôn escape trước khi đưa vào HTML (cùng quy ước tenant-lock). */
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

/** Lý do nhiều dòng: chuẩn hoá xuống dòng, bỏ dòng trống thừa ở hai đầu. */
function multiLine(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function multiLineHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export interface UserLockEmailData {
  /** Tên nền tảng hiệu lực (`getEffectiveBrand().name`) — không hard-code. */
  appName: string;
  /** Email đăng nhập của tài khoản (người nhận). */
  email: string;
  /** Lý do quản trị viên nhập (bắt buộc, ≤ 500 ký tự) — GỬI NGUYÊN VĂN cho người dùng. */
  reason: string;
  supportEmail?: string | null;
  /** Tên gian hàng nếu người dùng là chủ gian hàng — chỉ dùng ở email khoá. */
  ownedTenantName?: string | null;
  /** Link trang đăng nhập — chỉ dùng ở email mở khoá. */
  loginUrl?: string | null;
  /** Tài khoản đang bị bắt đặt lại mật khẩu — email mở khoá nhắc dùng "Quên mật khẩu". */
  passwordResetRequired?: boolean;
}

/**
 * ADR-073 — báo người dùng: tài khoản đã bị quản trị viên khoá. Hệ quả đã đối chiếu code (2026-11-26): đăng nhập bị từ chối
 * (`/api/auth/login` ACCOUNT_LOCKED), mọi refresh token bị thu hồi (`lockUser`) và guard khu vực nhạy cảm kiểm DB ngay
 * (`assertActiveSession`); Studio dùng `requireTenantMember` nên chủ gian hàng không vào được, nhưng không code nào đọc
 * `users.status` của chủ để khoá gian hàng/thanh toán/job; khoá chỉ đổi `users.status` — không xoá dữ liệu.
 */
export function renderUserLockedEmail(data: UserLockEmailData): RenderedEmail {
  const appName = singleLine(data.appName);
  const email = singleLine(data.email);
  const reason = multiLine(data.reason);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const tenantName = data.ownedTenantName ? singleLine(data.ownedTenantName) : null;
  const subject = `Tài khoản của bạn đã bị khoá — ${appName}`;
  const consequences = [
    "Bạn không thể đăng nhập; các thiết bị đang đăng nhập sẽ bị đăng xuất.",
    ...(tenantName ? [`Bạn không vào được Studio để quản lý gian hàng "${tenantName}". Gian hàng không bị khoá riêng.`] : []),
    "Hồ sơ và dữ liệu của bạn được giữ nguyên.",
  ];
  const contactText = support
    ? `Nếu bạn cho rằng đây là nhầm lẫn, hoặc đã khắc phục vấn đề nêu trên, vui lòng liên hệ ${support} để được xem xét mở khoá.`
    : `Nếu bạn cho rằng đây là nhầm lẫn, hoặc đã khắc phục vấn đề nêu trên, vui lòng phản hồi qua kênh hỗ trợ của ${appName} để được xem xét mở khoá.`;
  const text = [
    `Tài khoản ${email} của bạn trên ${appName} đã bị quản trị viên khoá.`,
    "",
    "Lý do:",
    reason,
    "",
    "Trong thời gian bị khoá:",
    ...consequences.map((line) => `- ${line}`),
    "",
    contactText,
    "",
    "Trân trọng,",
    appName,
  ].join("\n");
  const contactHtml = support
    ? `Nếu bạn cho rằng đây là nhầm lẫn, hoặc đã khắc phục vấn đề nêu trên, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a> để được xem xét mở khoá.`
    : escapeHtml(contactText);
  const html = `
    <p>Tài khoản <strong>${escapeHtml(email)}</strong> của bạn trên <strong>${escapeHtml(appName)}</strong> đã bị quản trị viên khoá.</p>
    <p><strong>Lý do:</strong><br>${multiLineHtml(reason)}</p>
    <p><strong>Trong thời gian bị khoá:</strong></p>
    <ul>
      ${consequences.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n      ")}
    </ul>
    <p>${contactHtml}</p>
    <p>Trân trọng,<br>${escapeHtml(appName)}</p>
  `.trim();
  return { subject, html, text };
}

/** ADR-073 — báo người dùng: tài khoản đã được mở khoá, kèm ghi chú của quản trị viên. */
export function renderUserUnlockedEmail(data: UserLockEmailData): RenderedEmail {
  const appName = singleLine(data.appName);
  const email = singleLine(data.email);
  const reason = multiLine(data.reason);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const loginUrl = data.loginUrl ? singleLine(data.loginUrl) : null;
  const subject = `Tài khoản của bạn đã được mở khoá — ${appName}`;
  const resetHint = data.passwordResetRequired
    ? 'Tài khoản cần đặt lại mật khẩu trước khi đăng nhập — hãy dùng "Quên mật khẩu" ở trang đăng nhập.'
    : null;
  const contactText = support
    ? `Cần hỗ trợ thêm, vui lòng liên hệ ${support}.`
    : `Cần hỗ trợ thêm, vui lòng phản hồi qua kênh hỗ trợ của ${appName}.`;
  const text = [
    `Tài khoản ${email} của bạn trên ${appName} đã được mở khoá.`,
    "",
    "Ghi chú từ quản trị viên:",
    reason,
    ...(loginUrl ? ["", `Đăng nhập: ${loginUrl}`] : []),
    ...(resetHint ? ["", resetHint] : []),
    "",
    contactText,
    "",
    "Trân trọng,",
    appName,
  ].join("\n");
  const contactHtml = support
    ? `Cần hỗ trợ thêm, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.`
    : escapeHtml(contactText);
  const html = `
    <p>Tài khoản <strong>${escapeHtml(email)}</strong> của bạn trên <strong>${escapeHtml(appName)}</strong> đã được mở khoá.</p>
    <p><strong>Ghi chú từ quản trị viên:</strong><br>${multiLineHtml(reason)}</p>
    ${loginUrl ? `<p><a href="${escapeHtml(loginUrl)}">Đăng nhập</a></p>` : ""}
    ${resetHint ? `<p>${escapeHtml(resetHint)}</p>` : ""}
    <p>${contactHtml}</p>
    <p>Trân trọng,<br>${escapeHtml(appName)}</p>
  `.trim();
  return { subject, html, text };
}
