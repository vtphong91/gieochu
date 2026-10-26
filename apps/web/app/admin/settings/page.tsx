import type { Metadata } from "next";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader } from "../_ui/kit";
import { ModuleTabs } from "../_ui/module-tabs";
import { SETTINGS_SUPPORT_EMAIL_TAB, SETTINGS_TABS, SETTINGS_TABS_LABEL } from "./_ui/settings-tabs";
import { SettingsForm } from "./settings-form";

/** ADR-058: title riêng theo tab. */
export const metadata: Metadata = { title: "Email hỗ trợ — Cấu hình chung" };

export default async function AdminSettingsPage() {
  await requireAdminAccess("/admin/settings");

  const prisma = getPrismaClient();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });

  return (
    // ADR-058: tab "Email hỗ trợ" của nhóm Cấu hình chung — h1 là tên nhóm. Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cấu hình chung" subtitle="Email hỗ trợ — địa chỉ liên hệ hỗ trợ của nền tảng, hiển thị cho người dùng khi cần trợ giúp." />
      <ModuleTabs label={SETTINGS_TABS_LABEL} items={SETTINGS_TABS} current={SETTINGS_SUPPORT_EMAIL_TAB} />

      {/* Full width theo khung app (quy tắc 2026-10-25) — thay SettingsGrid 2 cột. */}
      <div className="mt-6">
        <SettingsForm
          initial={{
            supportEmail: settings?.supportEmail ?? "",
          }}
        />
      </div>
    </div>
  );
}
