import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../_ui/kit";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdminAccess("/admin/settings");

  const prisma = getPrismaClient();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Email hỗ trợ" subtitle="Địa chỉ liên hệ hỗ trợ của nền tảng. Thời hạn phiên, đơn hàng, lượt tải mặc định… nằm ở Cấu hình chung." />

      <SettingsGrid>
        <SettingsForm
          initial={{
            supportEmail: settings?.supportEmail ?? "",
          }}
        />
      </SettingsGrid>

      <p className="mt-6 text-sm">
        <Link href="/admin/settings/general" className="inline-flex min-h-11 items-center font-medium text-[#0F3B82] underline underline-offset-2">
          Cấu hình chung (thời hạn phiên, đơn hàng, lượt tải) →
        </Link>
      </p>
    </main>
  );
}
