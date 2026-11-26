import type { AdminOwnerStatus, AdminTenantPaymentProvider, AdminTenantStatus } from "../../../../lib/admin-tenant-detail";

/**
 * ADR-072 — nhãn tiếng Việt + tông badge dùng chung cho danh sách `/admin/tenants` và trang chi tiết
 * `/admin/tenants/[tenantId]`. Badge luôn hiện CHỮ (không truyền nghĩa chỉ bằng màu).
 */
type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export const TENANT_STATUS_LABEL: Record<AdminTenantStatus, string> = {
  ACTIVE: "Hoạt động",
  READ_ONLY: "Tạm ngưng bán",
  LOCKED: "Đã khoá",
};

export const TENANT_STATUS_TONE: Record<AdminTenantStatus, Tone> = {
  ACTIVE: "success",
  READ_ONLY: "warning",
  LOCKED: "danger",
};

export const OWNER_STATUS_LABEL: Record<AdminOwnerStatus, string> = {
  PENDING: "Chờ kích hoạt",
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khoá",
};

export const OWNER_STATUS_TONE: Record<AdminOwnerStatus, Tone> = {
  PENDING: "warning",
  ACTIVE: "success",
  LOCKED: "danger",
};

/** Tên cổng thanh toán gian hàng đang bật (ADR-072 mục 2 — chỉ tên cổng, không số tài khoản/secret). */
export const PAYMENT_METHOD_LABEL: Record<AdminTenantPaymentProvider, string> = {
  MANUAL_QR: "QR chuyển khoản",
  MOMO_MANUAL: "MoMo cá nhân",
  SEPAY: "SePay",
  MOMO: "MoMo",
};

/** "2026-11-25" → "25/11/2026" (chuỗi ngày giờ VN do loader trả — không qua `Date` để khỏi lệch múi giờ). */
export function formatVnDateString(iso: string): string {
  const [year, month, day] = iso.split("-");
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

const storageNumber = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const MB = 1024 * 1024;

/** Dung lượng dễ đọc: dưới 1 GB hiện MB, từ 1 GB hiện GB (1 chữ số thập phân). */
export function formatStorage(bytes: number): string {
  const mb = bytes / MB;
  return mb >= 1024 ? `${storageNumber.format(mb / 1024)} GB` : `${storageNumber.format(mb)} MB`;
}

export function formatStorageFromMb(megabytes: number): string {
  return formatStorage(megabytes * MB);
}
