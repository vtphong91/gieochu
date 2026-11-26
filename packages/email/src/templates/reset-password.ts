import type { RenderedEmail } from "./verify-email";

export interface ResetPasswordTemplateData {
  appName: string;
  resetUrl: string;
  /** Hạn link (phút) — từ SystemSettings.passwordResetTtlMinutes (ADR-032), không hard-code. */
  expiresInMinutes: number;
  /**
   * ADR-073 — quản trị viên bấm "Yêu cầu đặt lại mật khẩu": thay đoạn mở đầu/kết (không nêu tên quản trị viên). Mặc định
   * false = email "Quên mật khẩu" do chính người dùng yêu cầu (nội dung giữ nguyên).
   */
  requestedByAdmin?: boolean;
}

export function renderResetPasswordEmailTemplate(data: ResetPasswordTemplateData): RenderedEmail {
  const subject = `Đặt lại mật khẩu ${data.appName}`;
  const intro = data.requestedByAdmin
    ? `Quản trị viên ${data.appName} đã yêu cầu bạn đặt lại mật khẩu. Các thiết bị đang đăng nhập đã được đăng xuất; bạn cần đặt mật khẩu mới trước khi đăng nhập lại.`
    : null;
  const outro = data.requestedByAdmin
    ? 'Nếu liên kết hết hạn, bạn có thể dùng "Quên mật khẩu" ở trang đăng nhập để nhận liên kết mới.'
    : "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.";
  const text = [
    "Chào bạn,",
    "",
    ...(intro ? [intro, ""] : []),
    `Bấm vào liên kết sau để đặt lại mật khẩu ${data.appName} (liên kết hết hạn sau ${data.expiresInMinutes} phút):`,
    data.resetUrl,
    "",
    outro,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    ${intro ? `<p>${intro}</p>` : ""}
    <p>Bấm vào liên kết sau để đặt lại mật khẩu <strong>${data.appName}</strong> (liên kết hết hạn sau ${data.expiresInMinutes} phút):</p>
    <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
    <p>${outro}</p>
  `.trim();
  return { subject, html, text };
}
