import type { ModuleTabItem } from "../../_ui/module-tabs";

/**
 * ADR-058 mục 3 — nhóm tab "Cấu hình chung": cấu hình nghiệp vụ chung + email hệ thống (địa chỉ hỗ trợ, máy chủ gửi SMTP).
 * Nhận diện thương hiệu, Lưu trữ file, Cloudinary giữ mục sidebar riêng (không gom Lưu trữ với Cloudinary).
 */
export const SETTINGS_TABS_LABEL = "Các trang trong Cấu hình chung";
export const SETTINGS_GENERAL_TAB = "/admin/settings/general";
export const SETTINGS_SUPPORT_EMAIL_TAB = "/admin/settings";
export const SETTINGS_SMTP_TAB = "/admin/settings/smtp";
export const SETTINGS_TABS: ModuleTabItem[] = [
  { href: SETTINGS_GENERAL_TAB, label: "Cấu hình chung" },
  { href: SETTINGS_SUPPORT_EMAIL_TAB, label: "Email hỗ trợ" },
  { href: SETTINGS_SMTP_TAB, label: "Cấu hình Email (SMTP)" },
];
