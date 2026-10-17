import type { RenderedEmail } from "./verify-email";

/** Nội dung do người dùng/admin nhập (tên gian hàng, lý do từ chối) — luôn escape trước khi đưa vào HTML. */
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

/** ADR-041 B — các bước của yêu cầu hoàn tiền gói gửi cho chủ gian hàng. */
export type SubscriptionRefundEmailStage = "REQUESTED" | "REFUNDED" | "REJECTED";

export interface SubscriptionRefundEmailData {
  /** Tên nền tảng hiệu lực (`getEffectiveBrand().name`) — không hard-code. */
  appName: string;
  tenantName: string;
  invoiceCode: string;
  /** Số tiền đã định dạng ở server, VD "199.000đ". */
  amountDisplay: string;
  billingUrl: string;
  /** Lý do từ chối (REJECTED) / ghi chú admin (REFUNDED, tuỳ chọn). Văn bản thuần. */
  adminNote?: string | null;
}

/**
 * KHÔNG chứa thông tin nhận tiền (ngân hàng/số tài khoản/tên chủ TK) — bổ sung ADR-041: dữ liệu đó chỉ admin xem.
 */
export function renderSubscriptionRefundEmail(stage: SubscriptionRefundEmailStage, data: SubscriptionRefundEmailData): RenderedEmail {
  const appName = singleLine(data.appName);
  const tenantName = singleLine(data.tenantName);
  const note = data.adminNote?.trim() || null;
  const copy: Record<SubscriptionRefundEmailStage, { subject: string; lines: string[] }> = {
    REQUESTED: {
      subject: `Đã nhận yêu cầu hoàn tiền gói dịch vụ "${tenantName}" — ${appName}`,
      lines: [
        `${appName} đã nhận yêu cầu hoàn tiền cho hoá đơn ${data.invoiceCode} (${data.amountDisplay}) của gian hàng "${tenantName}".`,
        "Quản trị viên sẽ kiểm tra và chuyển khoản hoàn tiền vào tài khoản bạn đã khai báo. Bạn sẽ nhận email khi yêu cầu được xử lý.",
      ],
    },
    REFUNDED: {
      subject: `Đã hoàn tiền gói dịch vụ "${tenantName}" — ${appName}`,
      lines: [
        `${appName} đã chuyển khoản hoàn ${data.amountDisplay} cho hoá đơn ${data.invoiceCode} của gian hàng "${tenantName}".`,
        "Gian hàng đã chuyển về gói Miễn phí; dữ liệu gian hàng được giữ nguyên. Bạn có thể nâng cấp lại bất cứ lúc nào.",
        ...(note ? [`Ghi chú: ${note}`] : []),
      ],
    },
    REJECTED: {
      subject: `Yêu cầu hoàn tiền gói dịch vụ "${tenantName}" không được chấp nhận — ${appName}`,
      lines: [
        `Yêu cầu hoàn tiền cho hoá đơn ${data.invoiceCode} (${data.amountDisplay}) của gian hàng "${tenantName}" không được chấp nhận.`,
        ...(note ? [`Lý do: ${note}`] : []),
        "Gói dịch vụ hiện tại của gian hàng không thay đổi.",
      ],
    },
  };
  const { subject, lines } = copy[stage];
  const text = ["Chào bạn,", "", ...lines, "", `Xem chi tiết: ${data.billingUrl}`].join("\n");
  const html = `
    <p>Chào bạn,</p>
    ${lines.map((line) => `<p>${escapeHtml(line).replace(/\n/g, "<br>")}</p>`).join("\n    ")}
    <p><a href="${escapeHtml(data.billingUrl)}">${escapeHtml(data.billingUrl)}</a></p>
  `.trim();
  return { subject, html, text };
}
