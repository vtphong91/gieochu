import type { ModuleTabItem } from "../../_ui/module-tabs";

/**
 * ADR-058 — nhóm tab "Trang CMS": các trang cùng chức năng "nội dung khung trang công khai của nền tảng". Một nguồn cho
 * page + loading để thanh tab không lệch. Trang Cửa hàng, Bảng giá, Chính sách sử dụng, Trang tuỳ chỉnh là mục sidebar riêng.
 */
export const CMS_TABS_LABEL = "Các trang trong Trang CMS";
export const CMS_HOME_TAB = "/admin/cms/home";
export const CMS_MENU_TAB = "/admin/cms/menu";
export const CMS_TABS: ModuleTabItem[] = [
  { href: CMS_HOME_TAB, label: "Trang chủ" },
  { href: CMS_MENU_TAB, label: "Header & Footer" },
];
