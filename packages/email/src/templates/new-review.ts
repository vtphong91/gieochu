import type { RenderedEmail } from "./verify-email";

export interface NewReviewTemplateData {
  tenantName: string;
  productTitle: string;
  /** 1–5. */
  rating: number;
  /** Tên hiển thị đã rút gọn ("Minh N.") — không phải email/họ tên đầy đủ. */
  displayName: string;
  body: string | null;
  /** Link tới Studio → Đánh giá. */
  manageUrl: string;
}

/** Nội dung/tên do khách nhập — luôn escape trước khi đưa vào HTML (cùng quy ước storefront-message). */
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

/**
 * ADR-029 mục 2: báo chủ tenant có đánh giá mới. Tiêu đề chỉ chứa tên trang (không chứa nội dung khách viết),
 * cùng lý do với email tin nhắn storefront.
 */
export function renderNewReviewEmail(data: NewReviewTemplateData): RenderedEmail {
  const tenantName = singleLine(data.tenantName);
  const productTitle = singleLine(data.productTitle);
  const displayName = singleLine(data.displayName);
  const rating = Math.min(Math.max(Math.trunc(data.rating), 1), 5);
  const stars = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
  const subject = `Đánh giá mới trên trang ${tenantName}`;
  const text = [
    "Chào bạn,",
    "",
    `Tài liệu "${productTitle}" vừa nhận được một đánh giá mới.`,
    "",
    `${displayName}: ${stars} (${rating}/5)`,
    ...(data.body ? ["", data.body] : []),
    "",
    `Xem, trả lời hoặc ẩn đánh giá: ${data.manageUrl}`,
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>Tài liệu <strong>${escapeHtml(productTitle)}</strong> trên trang <strong>${escapeHtml(tenantName)}</strong> vừa nhận được một đánh giá mới.</p>
    <p><strong>${escapeHtml(displayName)}</strong> — <span aria-label="${rating} trên 5 sao">${stars}</span> (${rating}/5)</p>
    ${data.body ? `<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d1d5db;white-space:pre-wrap">${escapeHtml(data.body)}</blockquote>` : ""}
    <p><a href="${escapeHtml(data.manageUrl)}">Xem và trả lời đánh giá</a></p>
  `.trim();
  return { subject, html, text };
}
