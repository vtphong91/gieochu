import type { HomeProductOption, HomeTenantOption } from "../../../../lib/home";
import type { PinOption } from "./pin-picker";

/** Dùng được cả ở server (page nạp sẵn) lẫn client (kết quả tìm) — chỉ import type từ lib/home. */
export function toTenantPinOption(option: HomeTenantOption): PinOption {
  return { id: option.id, label: option.name, hint: `/${option.slug} · ${option.productCount} tài liệu`, eligible: option.eligible };
}

/** Tài liệu trong danh sách luôn đang Công khai (id ghim không còn Công khai không có trong danh sách). */
export function toProductPinOption(option: HomeProductOption): PinOption {
  return { id: option.id, label: option.title, hint: option.tenantName, eligible: true };
}
