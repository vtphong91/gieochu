import Link from "next/link";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../_ui/kit";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdminAccess("/admin/settings");

  const prisma = getPrismaClient();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const env = getEnv();

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cấu hình hệ thống" subtitle="Thông tin nền tảng, thời hạn dùng thử/gia hạn, và các cấu hình vận hành khác." />

      <SettingsGrid>
        <SettingsForm
          initial={{
            platformName: settings?.platformName ?? env.APP_NAME,
            supportEmail: settings?.supportEmail ?? "",
            trialDays: settings?.trialDays ?? env.TRIAL_DAYS,
            graceDays: settings?.graceDays ?? env.GRACE_DAYS,
          }}
        />
      </SettingsGrid>

      <p className="mt-6 text-sm">
        <Link href="/admin/settings/storage" className="font-medium text-[#0F3B82] underline">
          Cấu hình lưu trữ file (S3-compatible) →
        </Link>
      </p>
    </main>
  );
}
