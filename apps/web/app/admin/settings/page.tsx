import Link from "next/link";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireAdminAccess("/admin/settings");

  const prisma = getPrismaClient();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const env = getEnv();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Cấu hình hệ thống</h1>
      <SettingsForm
        initial={{
          platformName: settings?.platformName ?? env.APP_NAME,
          supportEmail: settings?.supportEmail ?? "",
          trialDays: settings?.trialDays ?? env.TRIAL_DAYS,
          graceDays: settings?.graceDays ?? env.GRACE_DAYS,
        }}
      />
      <p className="mt-6 text-sm">
        <Link href="/admin/settings/storage" className="text-[var(--color-primary)] underline">
          Cấu hình lưu trữ file (S3-compatible) →
        </Link>
      </p>
    </main>
  );
}
