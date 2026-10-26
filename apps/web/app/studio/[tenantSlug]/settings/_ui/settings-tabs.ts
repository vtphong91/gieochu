import type { ModuleTabItem } from "../../../../admin/_ui/module-tabs";

/**
 * ADR-058 (task 2.1) — nhóm tab "Cài đặt" của Studio: các trang cùng chức năng "cấu hình gian hàng". Một nguồn cho cả 2
 * trang. Mục sidebar "Cài đặt" (`/studio/{slug}/settings`) đã khớp tiền tố `/settings/payments` nên tự sáng ở cả 2 tab.
 */
export const STUDIO_SETTINGS_TABS_LABEL = "Các trang trong Cài đặt";

export function studioSettingsTabs(tenantSlug: string): ModuleTabItem[] {
  const base = `/studio/${tenantSlug}/settings`;
  return [
    { href: base, label: "Thông tin & thương hiệu" },
    { href: `${base}/payments`, label: "Thanh toán" },
  ];
}
