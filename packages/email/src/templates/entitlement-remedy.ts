import type { RenderedEmail } from "./verify-email";

/** Nội dung do tenant nhập (tên gian hàng, tên tài liệu) — luôn escape trước khi đưa vào HTML. */
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

export interface PurchaseRemedyCustomerTemplateData {
  /** Tên nền tảng hiệu lực (`getEffectiveBrand().name`) — không hard-code. */
  appName: string;
  tenantName: string;
  productTitle: string;
  /** false = đơn 0đ → chỉ có lựa chọn tải lần cuối. */
  refundAvailable: boolean;
  /** Link trang thư viện của khách (nơi chọn). */
  libraryUrl: string;
  supportEmail?: string | null;
}

/**
 * ADR-039 mục 5 — báo khách đã mua: tài liệu bị gỡ do vi phạm chính sách, tải đang tạm khoá cho tới khi khách chọn.
 * KHÔNG nhắc tới người báo cáo hay nội dung báo cáo.
 */
export function renderPurchaseRemedyCustomerEmail(data: PurchaseRemedyCustomerTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const productTitle = singleLine(data.productTitle);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const subject = `Tài liệu "${productTitle}" đã bị gỡ — vui lòng chọn cách xử lý — ${appName}`;
  const optionA =
    "Tải lần cuối: bạn được tải mỗi tệp của tài liệu thêm đúng 1 lần, chỉ để sử dụng cá nhân, không chia sẻ hay phát tán. Bạn chịu trách nhiệm nếu phát tán tài liệu.";
  const optionB = `Yêu cầu hoàn tiền: quyền tải bị khoá vĩnh viễn và yêu cầu được chuyển tới gian hàng "${tenantName}" để hoàn tiền cho bạn.`;
  const intro = `Tài liệu "${productTitle}" bạn đã mua tại gian hàng "${tenantName}" đã bị gỡ khỏi ${appName} do vi phạm chính sách nội dung. Quyền tải tài liệu đang tạm khoá cho tới khi bạn chọn cách xử lý.`;
  const choiceNote = data.refundAvailable
    ? "Bạn có 2 lựa chọn (chỉ chọn được một lần, không đổi lại được):"
    : "Đơn hàng của bạn có giá 0đ nên bạn có lựa chọn sau:";
  const options = data.refundAvailable ? [optionA, optionB] : [optionA];
  const text = [
    "Chào bạn,",
    "",
    intro,
    "",
    choiceNote,
    ...options.map((o) => `- ${o}`),
    "",
    `Chọn trong Thư viện của bạn: ${data.libraryUrl}`,
    ...(support ? ["", `Nếu cần hỗ trợ, vui lòng liên hệ ${support}.`] : []),
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(intro)}</p>
    <p>${escapeHtml(choiceNote)}</p>
    <ul>${options.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>
    <p><a href="${escapeHtml(data.libraryUrl)}">Mở Thư viện để chọn</a></p>
    ${support ? `<p>Nếu cần hỗ trợ, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.</p>` : ""}
  `.trim();
  return { subject, html, text };
}

export interface PurchaseRemedyTenantTemplateData {
  appName: string;
  tenantName: string;
  productTitle: string;
  /** Tổng số khách bị ảnh hưởng (entitlement chuyển sang chờ chọn). */
  affectedCount: number;
  /** Trong đó số khách có đơn > 0đ (được quyền yêu cầu hoàn tiền). */
  refundEligibleCount: number;
  refundSlaDays: number;
  /** Link Studio → Đơn hàng (lọc yêu cầu hoàn tiền). */
  ordersUrl: string;
  supportEmail?: string | null;
}

/**
 * ADR-039 mục 3 + 5 — báo chủ gian hàng: số khách bị ảnh hưởng, đề nghị xử lý hoàn tiền trong N ngày khi khách yêu cầu.
 * Không có danh sách khách (tenant tự xem trong Studio). Tiêu đề không chứa số liệu (dòng log gửi email admin xem được).
 */
export function renderPurchaseRemedyTenantEmail(data: PurchaseRemedyTenantTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const productTitle = singleLine(data.productTitle);
  const support = data.supportEmail ? singleLine(data.supportEmail) : null;
  const subject = `Quyền lợi người mua tài liệu bị gỡ trên gian hàng ${tenantName} — ${appName}`;
  const lines = [
    `Tài liệu "${productTitle}" trên gian hàng "${tenantName}" đã bị lưu trữ do vi phạm. Có ${data.affectedCount} khách đã mua tài liệu này bị ảnh hưởng; trong đó ${data.refundEligibleCount} khách có đơn trả phí được quyền yêu cầu hoàn tiền.`,
    "Mỗi khách sẽ chọn tải lần cuối hoặc yêu cầu hoàn tiền.",
    `Khi khách yêu cầu hoàn tiền, ${appName} không giữ tiền bán tài liệu nên bạn là người hoàn tiền trực tiếp cho khách. Vui lòng xử lý trong ${data.refundSlaDays} ngày rồi bấm "Hoàn tiền" ở trang đơn hàng tương ứng. Yêu cầu quá hạn có thể dẫn tới việc gian hàng bị xem xét khoá.`,
  ];
  const text = [
    "Chào bạn,",
    "",
    ...lines.flatMap((l) => [l, ""]),
    `Xem yêu cầu hoàn tiền trong Studio: ${data.ordersUrl}`,
    ...(support ? ["", `Nếu cần hỗ trợ, vui lòng liên hệ ${support}.`] : []),
  ].join("\n");
  const html = `
    <p>Chào bạn,</p>
    ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n    ")}
    <p><a href="${escapeHtml(data.ordersUrl)}">Xem yêu cầu hoàn tiền trong Studio</a></p>
    ${support ? `<p>Nếu cần hỗ trợ, vui lòng liên hệ <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.</p>` : ""}
  `.trim();
  return { subject, html, text };
}

export interface RefundRequestedTemplateData {
  appName: string;
  tenantName: string;
  productTitle: string;
  orderCode: string;
  /** Đã định dạng VND bởi caller. */
  totalVndDisplay: string;
  refundSlaDays: number;
  orderUrl: string;
}

/** ADR-039 mục 3 — báo chủ gian hàng 1 khách vừa yêu cầu hoàn tiền (kèm mã đơn; tenant xem đơn của mình trong Studio). */
export function renderRefundRequestedEmail(data: RefundRequestedTemplateData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const productTitle = singleLine(data.productTitle);
  const orderCode = singleLine(data.orderCode);
  const subject = `Yêu cầu hoàn tiền đơn ${orderCode} — ${appName}`;
  const body = `Khách của đơn ${orderCode} (tài liệu "${productTitle}", ${data.totalVndDisplay}) trên gian hàng "${tenantName}" đã yêu cầu hoàn tiền vì tài liệu bị gỡ do vi phạm. Quyền tải của khách đã bị khoá.`;
  const action = `Vui lòng hoàn tiền trực tiếp cho khách trong ${data.refundSlaDays} ngày rồi bấm "Hoàn tiền" ở trang đơn hàng.`;
  const text = ["Chào bạn,", "", body, "", action, "", `Xem đơn hàng: ${data.orderUrl}`].join("\n");
  const html = `
    <p>Chào bạn,</p>
    <p>${escapeHtml(body)}</p>
    <p>${escapeHtml(action)}</p>
    <p><a href="${escapeHtml(data.orderUrl)}">Xem đơn hàng</a></p>
  `.trim();
  return { subject, html, text };
}
