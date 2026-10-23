import type { CustomerDateField, CustomerGroup, CustomerListQuery, CustomerListSort } from "../../../../../lib/customer-list";

/*
 * ADR-048 — nhãn và tiện ích hiển thị của trang Khách hàng Studio. File thuần (không JSX, không I/O, chỉ `import type`
 * từ loader) để Server lẫn Client Component dùng chung — `lib/customer-list.ts` kéo `@gieochu/db` nên client không được
 * import giá trị từ đó. Dữ liệu/kiểu/URL lấy từ loader (`listCustomersPage`, `buildCustomerListSearch`).
 */

export const CUSTOMER_GROUP_LABEL: Record<CustomerGroup, string> = {
  "tat-ca": "Tất cả khách",
  moi: "Khách mới",
  "quay-lai": "Khách quay lại",
  "mien-phi": "Chỉ nhận miễn phí",
  "hoan-tien": "Có yêu cầu hoàn tiền",
  "lau-chua-quay-lai": "Lâu chưa quay lại (90 ngày)",
};

export const CUSTOMER_DATE_FIELD_LABEL: Record<CustomerDateField, string> = {
  "mua-dau": "Mua lần đầu",
  "mua-gan-nhat": "Mua gần nhất",
};

export const CUSTOMER_SORT_LABEL: Record<CustomerListSort, string> = {
  "gan-nhat": "Mua gần nhất (mới → cũ)",
  "moi-nhat": "Mua lần đầu (mới → cũ)",
  "chi-tieu-giam": "Tổng chi tiêu (cao → thấp)",
  "so-don-giam": "Số đơn (nhiều → ít)",
};

/** Kết quả Server Action lưu ghi chú khách (`useActionState`). */
export interface CustomerNoteState {
  ok?: boolean;
  error?: string;
}

/**
 * Server Action lưu ghi chú — trang bind `tenantSlug` rồi truyền xuống; client bind thêm `userId`. Ô form: `note`
 * (rỗng = xoá ghi chú).
 */
export type CustomerNoteAction = (userId: string, prev: CustomerNoteState, formData: FormData) => Promise<CustomerNoteState>;

/** Số điều kiện lọc đang bật (không tính sắp xếp/phân trang/mốc ngày). */
export function countActiveCustomerFilters(query: CustomerListQuery): number {
  return [query.q, query.group !== "tat-ca", query.range, query.productId].filter(Boolean).length;
}

/** Link sang trang Đơn hàng lọc theo khách (`?khach=<userId>`, ADR-048). */
export function customerOrdersHref(tenantSlug: string, userId: string): string {
  return `/studio/${tenantSlug}/orders?${new URLSearchParams({ khach: userId }).toString()}`;
}

/** Tên hiển thị: họ tên → email. */
export function customerDisplayName(c: { fullName: string | null; email: string }): string {
  return c.fullName?.trim() ? c.fullName : c.email;
}

/** Tỉ lệ 0–1 → "62,5%"; null → null. */
export function formatRate(rate: number | null): string | null {
  if (rate === null || !Number.isFinite(rate)) return null;
  return `${(Math.round(rate * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}
