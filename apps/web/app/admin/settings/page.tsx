import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { getEffectiveBrand } from "../../../lib/branding";
import { getSystemSettings } from "../../../lib/system-settings";
import { AdminPageHeader, SettingsGrid } from "../_ui/kit";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdminAccess("/admin/settings");

  const prisma = getPrismaClient();
  const [settings, effective, brand] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { id: "default" } }),
    getSystemSettings(),
    getEffectiveBrand(),
  ]);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cấu hình hệ thống" subtitle="Thông tin nền tảng, thời hạn dùng thử/gia hạn, và các cấu hình vận hành khác." />

      <SettingsGrid>
        <SettingsForm
          initial={{
            platformName: settings?.platformName ?? brand.name,
            supportEmail: settings?.supportEmail ?? "",
            trialDays: effective.trialDays,
            graceDays: effective.graceDays,
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
