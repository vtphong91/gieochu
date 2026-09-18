import type { RenderedEmail } from "./verify-email";

/** §"M3 v2" ADR-021: EXPIRED renamed DOWNGRADED_TO_FREE — grace lapsing no longer suspends selling, it downgrades the plan. */
export type SubscriptionEmailStage = "REMINDER_7D" | "REMINDER_1D" | "GRACE" | "DOWNGRADED_TO_FREE";

export interface SubscriptionStatusEmailData {
  appName: string;
  tenantName: string;
  billingUrl: string;
  periodEndDisplay?: string;
}

const COPY: Record<SubscriptionEmailStage, (data: SubscriptionStatusEmailData) => { subject: string; lines: string[] }> = {
  REMINDER_7D: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" sắp hết hạn (còn 7 ngày)`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" sẽ hết hạn vào ${data.periodEndDisplay}.`,
      `Gia hạn sớm để giữ nguyên giới hạn/tính năng hiện tại — nếu không gia hạn, trang sẽ tự động chuyển về gói Free sau thời gian ân hạn.`,
    ],
  }),
  REMINDER_1D: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" hết hạn vào ngày mai`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" sẽ hết hạn vào ${data.periodEndDisplay} (còn 1 ngày).`,
      `Gia hạn ngay để tránh bị chuyển về gói Free.`,
    ],
  }),
  GRACE: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" đã hết hạn — đang trong thời gian ân hạn`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" đã hết hạn và đang trong thời gian ân hạn.`,
      `Thanh toán trước khi hết thời gian ân hạn để giữ nguyên gói hiện tại — hết ân hạn mà chưa thanh toán, trang sẽ tự động chuyển về gói Free.`,
    ],
  }),
  DOWNGRADED_TO_FREE: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" đã chuyển về gói Free`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" đã hết hạn ân hạn nên được tự động chuyển về gói Free.`,
      `Trang vẫn bán hàng bình thường, khách hàng cũ vẫn tải được tài liệu đã mua — chỉ áp dụng lại giới hạn số sản phẩm/dung lượng của gói Free. Nâng cấp lại bất cứ lúc nào.`,
    ],
  }),
};

export function renderSubscriptionStatusEmail(stage: SubscriptionEmailStage, data: SubscriptionStatusEmailData): RenderedEmail {
  const { subject, lines } = COPY[stage](data);
  const text = ["Chào bạn,", "", ...lines, "", `Xem chi tiết và gia hạn: ${data.billingUrl}`].join("\n");
  const html = `
    <p>Chào bạn,</p>
    ${lines.map((line) => `<p>${line}</p>`).join("\n    ")}
    <p><a href="${data.billingUrl}">${data.billingUrl}</a></p>
  `.trim();
  return { subject, html, text };
}
