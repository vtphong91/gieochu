export interface VerifyEmailTemplateData {
  appName: string;
  verifyUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderVerifyEmailTemplate(data: VerifyEmailTemplateData): RenderedEmail {
  const subject = `Kích hoạt tài khoản ${data.appName}`;
  const text = [
    "Chào bạn,",
    "",
    `Bấm vào liên kết sau để kích hoạt tài khoản ${data.appName} (liên kết hết hạn sau 24 giờ):`,
    data.verifyUrl,
    "",
    "Nếu bạn không yêu cầu tạo tài khoản này, hãy bỏ qua email này.",
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Bấm vào liên kết sau để kích hoạt tài khoản <strong>${data.appName}</strong> (liên kết hết hạn sau 24 giờ):</p>
    <p><a href="${data.verifyUrl}">${data.verifyUrl}</a></p>
    <p>Nếu bạn không yêu cầu tạo tài khoản này, hãy bỏ qua email này.</p>
  `.trim();
  return { subject, html, text };
}
