import type { Metadata } from "next";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemSettingsPageData } from "../../../../lib/system-settings";
import { AdminPageHeader } from "../../_ui/kit";
import { IconAlertTriangle } from "../../_ui/icons";
import { ModuleTabs } from "../../_ui/module-tabs";
import { SETTINGS_GENERAL_TAB, SETTINGS_TABS, SETTINGS_TABS_LABEL } from "../_ui/settings-tabs";
import { GeneralSettingsForm } from "./general-settings-form";

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** ADR-058: title riêng theo tab. */
export const metadata: Metadata = { title: "Cấu hình chung" };

/** ADR-032 — cấu hình hệ thống: thời hạn phiên/liên kết/URL ký, ân hạn, đơn/hoá đơn chờ, lượt tải mặc định. */
export default async function AdminGeneralSettingsPage() {
  await requireAdminAccess("/admin/settings/general");
  const data = await getSystemSettingsPageData();

  // Khoá đang ẩn (chưa có nghiệp vụ dùng) không có ô để sửa → không cảnh báo.
  const invalidVisible = data.invalidKeys.filter((key) => !data.inactiveKeys.includes(key));

  return (
    // ADR-058: tab "Cấu hình chung" (mặc định) của nhóm cùng tên. Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Cấu hình chung"
        subtitle="Thời hạn phiên và liên kết, ân hạn gói, đơn/hoá đơn chờ thanh toán và lượt tải mặc định. Thay đổi chỉ áp dụng cho thao tác mới."
      />
      <ModuleTabs label={SETTINGS_TABS_LABEL} items={SETTINGS_TABS} current={SETTINGS_GENERAL_TAB} />

      <p className="mt-4 text-sm" style={{ color: "#4B5563" }}>
        {data.isDefault || !data.updatedAt ? (
          "Chưa lưu lần nào — hệ thống đang dùng giá trị mặc định."
        ) : (
          <>
            Cập nhật lần cuối <time dateTime={data.updatedAt.toISOString()}>{dateTime.format(data.updatedAt)}</time>
            {data.updatedByEmail ? (
              <>
                {" "}
                bởi <span className="font-medium [overflow-wrap:anywhere]" style={{ color: "#12213A" }}>{data.updatedByEmail}</span>
              </>
            ) : null}
            .
          </>
        )}
      </p>

      {invalidVisible.length > 0 ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}
        >
          <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Một số giá trị đang lưu không hợp lệ — hệ thống tạm dùng mặc định:</p>
            <p className="mt-1">{invalidVisible.map((key) => data.bounds[key].label).join(", ")}.</p>
            <p className="mt-1">Kiểm tra lại các ô này rồi bấm Lưu cấu hình.</p>
          </div>
        </div>
      ) : null}

      <GeneralSettingsForm values={data.values} bounds={data.bounds} inactiveKeys={data.inactiveKeys} />
    </div>
  );
}
