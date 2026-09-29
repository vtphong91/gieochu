import { SYSTEM_SETTING_KEYS } from "@gieochu/core";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemSettingsPageData } from "../../../../lib/system-settings";
import { AdminPageHeader } from "../../_ui/kit";

/**
 * ADR-032 — trang cấu hình hệ thống. Bản tối thiểu (guard + loader, chỉ đọc) do Hiếu dựng để có route;
 * form sửa (gọi `updateSystemSettingsAction` ở ./actions.ts) do Phong làm theo contract.
 */
export default async function AdminGeneralSettingsPage() {
  await requireAdminAccess("/admin/settings/general");
  const data = await getSystemSettingsPageData();

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cấu hình chung" subtitle="Thời hạn phiên, liên kết, dùng thử/ân hạn, đơn hàng và lượt tải mặc định. Thay đổi chỉ áp dụng cho thao tác mới." />
      <dl className="mt-6 grid gap-2 text-sm">
        {SYSTEM_SETTING_KEYS.map((key) => {
          const bound = data.bounds[key];
          return (
            <div key={key} className="flex justify-between gap-4 border-b py-2">
              <dt>{bound.label}</dt>
              <dd>
                {data.values[key]} {bound.unit} ({bound.min}–{bound.max})
                {data.invalidKeys.includes(key) ? " — giá trị lưu không hợp lệ, đang dùng mặc định" : ""}
              </dd>
            </div>
          );
        })}
      </dl>
    </main>
  );
}
