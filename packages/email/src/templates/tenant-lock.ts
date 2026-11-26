import type { RenderedEmail } from "./verify-email";

/** Nội dung do quản trị viên/tenant nhập — luôn escape trước khi đưa vào HTML (cùng quy ước abuse-report). */
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

export interface TenantLockEmailData {
  /** Tên nền tảng hiệu lực (`getEffectiveBrand().name`) — không hard-code. */
  appName: string;
  tenantName: string;
  /** Lý do quản trị viên nhập (bắt buộc, ≤ 500 ký tự) — GỬI NGUYÊN VĂN cho chủ gian hàng. */
  reason: string;
  supportEmail?: string | null;
  /** Link Studio của gian hàng — chỉ dùng ở email mở khoá. */
  studioUrl?: string | null;
}

/**
 * ADR-072 mục 3 — báo chủ gian hàng: gian hàng đã bị quản trị viên khoá. Ba hệ quả đã đối chiếu code (2026-11-26):
 * khách không thấy gian hàng/tài liệu và không mua mới được (`resolveStorefrontAccess` → 404, checkout yêu cầu ACTIVE);
 * `assertTenantCanWrite` chặn tạo/sửa tài liệu, bài viết, mã giảm giá (giao diện gian hàng, cài đặt KHÔNG bị chặn nên câu
 * chữ chỉ nêu ba loại nội dung này); tải tài liệu đã mua không kiểm trạng thái gian hàng (`lib/download.ts`).
 */
export function renderTenantLockedEmail(data: TenantLockEmailData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const reason = multiLine(data.reason);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const subject = `Gian hàng "${tenantName}" đã bị khoá — ${appName}`;
  const consequences = [
    "Trang gian hàng và tài liệu không hiển thị công khai; khách không thể mua mới.",
    "Bạn vẫn đăng nhập được Studio nhưng không thể tạo hay chỉnh sửa tài liệu, bài viết và mã giảm giá.",
    "Khách đã mua trước đó vẫn tải được tài liệu trong thư viện của họ.",
  ];
  const contactText = support
    ? `Nếu bạn cho rằng đây là nhầm lẫn, hoặc đã khắc phục vấn đề nêu trên, vui lòng liên hệ ${support} để được xem xét mở khoá.`
    : `Nếu bạn cho rằng đây là nhầm lẫn, hoặc đã khắc phục vấn đề nêu trên, vui lòng phản hồi qua kênh hỗ trợ của ${appName} để được xem xét mở khoá.`;
  const text = [
    `Gian hàng "${tenantName}" của bạn trên ${appName} đã bị quản trị viên khoá.`,
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
    <p>Gian hàng <strong>"${escapeHtml(tenantName)}"</strong> của bạn trên <strong>${escapeHtml(appName)}</strong> đã bị quản trị viên khoá.</p>
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

/** ADR-072 mục 3 — báo chủ gian hàng: gian hàng đã được mở khoá, kèm ghi chú của quản trị viên. */
export function renderTenantUnlockedEmail(data: TenantLockEmailData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const reason = multiLine(data.reason);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const studioUrl = data.studioUrl ? singleLine(data.studioUrl) : null;
  const subject = `Gian hàng "${tenantName}" đã được mở khoá — ${appName}`;
  const restored =
    "Trang gian hàng và tài liệu hiển thị công khai trở lại, khách có thể mua, và bạn có thể chỉnh sửa nội dung như bình thường.";
  const contactText = support
    ? `Cần hỗ trợ thêm, vui lòng liên hệ ${support}.`
    : `Cần hỗ trợ thêm, vui lòng phản hồi qua kênh hỗ trợ của ${appName}.`;
  const text = [
    `Gian hàng "${tenantName}" của bạn trên ${appName} đã được mở khoá và hoạt động trở lại.`,
    "",
    "Ghi chú từ quản trị viên:",
    reason,
    "",
    restored,
    ...(studioUrl ? ["", `Vào Studio: ${studioUrl}`] : []),
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
    <p>Gian hàng <strong>"${escapeHtml(tenantName)}"</strong> của bạn trên <strong>${escapeHtml(appName)}</strong> đã được mở khoá và hoạt động trở lại.</p>
    <p><strong>Ghi chú từ quản trị viên:</strong><br>${multiLineHtml(reason)}</p>
    <p>${escapeHtml(restored)}</p>
    ${studioUrl ? `<p><a href="${escapeHtml(studioUrl)}">Vào Studio</a></p>` : ""}
    <p>${contactHtml}</p>
    <p>Trân trọng,<br>${escapeHtml(appName)}</p>
  `.trim();
  return { subject, html, text };
}
