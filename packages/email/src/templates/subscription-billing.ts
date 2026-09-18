import type { RenderedEmail } from "./verify-email";

export type SubscriptionEmailStage = "REMINDER_7D" | "REMINDER_1D" | "GRACE" | "EXPIRED";

export interface SubscriptionStatusEmailData {
  appName: string;
  tenantName: string;
  billingUrl: string;
  /** Local (Asia/Ho_Chi_Minh) display string, already formatted by the caller — email templates don't own TZ conversion. */
  periodEndDisplay?: string;
}

const COPY: Record<SubscriptionEmailStage, (data: SubscriptionStatusEmailData) => { subject: string; lines: string[] }> = {
  REMINDER_7D: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" sắp hết hạn (còn 7 ngày)`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" sẽ hết hạn vào ${data.periodEndDisplay}.`,
      `Gia hạn sớm để trang không bị chuyển sang chế độ tạm ngưng bán.`,
    ],
  }),
  REMINDER_1D: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" hết hạn vào ngày mai`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" sẽ hết hạn vào ${data.periodEndDisplay} (còn 1 ngày).`,
      `Gia hạn ngay để tránh gián đoạn.`,
    ],
  }),
  GRACE: (data) => ({
    subject: `Gói dịch vụ "${data.tenantName}" đã hết hạn — đang trong thời gian ân hạn`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" đã hết hạn và đang trong thời gian ân hạn.`,
      `Thanh toán trước khi hết thời gian ân hạn để tránh trang bị chuyển sang chế độ tạm ngưng bán.`,
    ],
  }),
  EXPIRED: (data) => ({
    subject: `Trang "${data.tenantName}" đã bị tạm ngưng bán do chưa gia hạn`,
    lines: [
      `Gói dịch vụ của trang "${data.tenantName}" đã hết hạn ân hạn.`,
      `Trang chuyển sang chế độ tạm ngưng bán: khách hàng cũ vẫn tải được tài liệu đã mua, nhưng bạn không thể đăng sản phẩm/bài viết mới hoặc nhận đơn mới cho tới khi gia hạn.`,
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
