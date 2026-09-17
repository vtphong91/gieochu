import type { RenderedEmail } from "./verify-email";

export interface ResetPasswordTemplateData {
  appName: string;
  resetUrl: string;
}

export function renderResetPasswordEmailTemplate(data: ResetPasswordTemplateData): RenderedEmail {
  const subject = `Đặt lại mật khẩu ${data.appName}`;
  const text = [
    "Chào bạn,",
    "",
    `Bấm vào liên kết sau để đặt lại mật khẩu ${data.appName} (liên kết hết hạn sau 30 phút):`,
    data.resetUrl,
    "",
    "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.",
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Bấm vào liên kết sau để đặt lại mật khẩu <strong>${data.appName}</strong> (liên kết hết hạn sau 30 phút):</p>
    <p><a href="${data.resetUrl}">${data.resetUrl}</a></p>
    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn an toàn.</p>
  `.trim();
  return { subject, html, text };
}
