import type { RenderedEmail } from "./verify-email";

/** Nội dung do người dùng/tenant nhập — luôn escape trước khi đưa vào HTML (cùng quy ước new-review). */
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

export interface AbuseReportResolvedTemplateData {
  /** Tên nền tảng hiệu lực (`getEffectiveBrand().name`) — không hard-code. */
  appName: string;
  /** "Tài liệu" | "Đánh giá" | "Bài viết". */
  targetTypeLabel: string;
  /** true = đã áp dụng biện pháp xử lý; false = bác bỏ (không phát hiện vi phạm). */
  actionTaken: boolean;
  supportEmail?: string | null;
}

/**
 * ADR-038 mục 6 — báo người gửi báo cáo rằng báo cáo đã được xem xét. Chỉ nêu quyết định CHUNG (đã xử lý / không phát
 * hiện vi phạm) — không nêu biện pháp cụ thể, tên gian hàng hay ghi chú nội bộ của admin.
 */
export function renderAbuseReportResolvedEmail(data: AbuseReportResolvedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const targetLabel = singleLine(data.targetTypeLabel).toLowerCase();
  const subject = `Báo cáo vi phạm của bạn đã được xử lý — ${appName}`;
  const outcome = data.actionTaken
    ? `Chúng tôi đã xem xét và áp dụng biện pháp xử lý phù hợp với ${targetLabel} bạn báo cáo.`
    : `Chúng tôi đã xem xét ${targetLabel} bạn báo cáo và chưa ghi nhận vi phạm theo quy định của nền tảng.`;
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const text = [
    "Chào bạn,",
    "",
    `Cảm ơn bạn đã gửi báo cáo vi phạm tới ${appName}.`,
    outcome,
    ...(support ? ["", `Nếu cần trao đổi thêm, vui lòng liên hệ ${support}.`] : []),
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Cảm ơn bạn đã gửi báo cáo vi phạm tới <strong>${escapeHtml(appName)}</strong>.</p>
    <p>${escapeHtml(outcome)}</p>
    ${support ? `<p>Nếu cần trao đổi thêm, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.</p>` : ""}
  `.trim();
  return { subject, html, text };
}

export interface ContentModeratedTemplateData {
  appName: string;
  tenantName: string;
  /** Nhãn loại vi phạm ("Vi phạm bản quyền"...). */
  violationLabel: string;
  /** Nhãn quyết định ("Ẩn nội dung" / "Lưu trữ tài liệu" / "Khoá gian hàng"). */
  decisionLabel: string;
  /** Nhãn loại nội dung ("Tài liệu" / "Đánh giá" / "Bài viết"). */
  targetTypeLabel: string;
  /** Tiêu đề / trích đoạn nội dung bị xử lý (đã rút gọn); null khi nội dung không còn tồn tại. */
  contentSummary: string | null;
  /** true khi biện pháp là khoá cả gian hàng. */
  tenantLocked: boolean;
  /** Link Studio liên quan (tuỳ chọn). */
  manageUrl?: string | null;
  supportEmail?: string | null;
}

/**
 * ADR-038 mục 4 + 6 — báo chủ gian hàng nội dung của họ bị xử lý do vi phạm. Chỉ gồm loại vi phạm, nội dung bị xử lý
 * và quyết định — KHÔNG BAO GIỜ chứa danh tính/email người báo cáo hay mô tả họ viết.
 */
export function renderContentModeratedEmail(data: ContentModeratedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const violation = singleLine(data.violationLabel);
  const decision = singleLine(data.decisionLabel);
  const targetLabel = singleLine(data.targetTypeLabel);
  const summary = data.contentSummary ? singleLine(data.contentSummary) : null;
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const subject = data.tenantLocked
    ? `Gian hàng ${tenantName} đã bị khoá do vi phạm — ${appName}`
    : `Nội dung trên gian hàng ${tenantName} đã bị xử lý do vi phạm — ${appName}`;
  const consequence = data.tenantLocked
    ? "Gian hàng tạm thời không hiển thị công khai và không bán được cho tới khi được mở khoá."
    : "Nội dung này bị khoá kiểm duyệt: bạn không thể tự xuất bản lại hoặc bỏ ẩn cho tới khi quản trị viên gỡ khoá.";
  const text = [
    "Chào bạn,",
    "",
    `Sau khi xem xét một báo cáo vi phạm, ${appName} đã áp dụng biện pháp xử lý với gian hàng "${tenantName}".`,
    "",
    `Loại vi phạm: ${violation}`,
    `Nội dung: ${targetLabel}${summary ? ` — ${summary}` : ""}`,
    `Quyết định: ${decision}`,
    "",
    consequence,
    ...(data.manageUrl ? ["", `Xem trong Studio: ${data.manageUrl}`] : []),
    ...(support ? ["", `Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ ${support}.`] : []),
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Sau khi xem xét một báo cáo vi phạm, <strong>${escapeHtml(appName)}</strong> đã áp dụng biện pháp xử lý với gian hàng <strong>${escapeHtml(tenantName)}</strong>.</p>
    <ul>
      <li>Loại vi phạm: <strong>${escapeHtml(violation)}</strong></li>
      <li>Nội dung: ${escapeHtml(targetLabel)}${summary ? ` — <em>${escapeHtml(summary)}</em>` : ""}</li>
      <li>Quyết định: <strong>${escapeHtml(decision)}</strong></li>
    </ul>
    <p>${escapeHtml(consequence)}</p>
    ${data.manageUrl ? `<p><a href="${escapeHtml(data.manageUrl)}">Xem trong Studio</a></p>` : ""}
    ${support ? `<p>Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.</p>` : ""}
  `.trim();
  return { subject, html, text };
}
