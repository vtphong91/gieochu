import type { Metadata } from "next";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemSmtpConfig } from "../../../../lib/system-smtp";
import { getEffectiveBrand } from "../../../../lib/branding";
import { AdminPageHeader, Badge } from "../../_ui/kit";
import { RefreshButton } from "./refresh-button";
import { SmtpTabs } from "./smtp-tabs";
import { ModuleTabs } from "../../_ui/module-tabs";
import { SETTINGS_SMTP_TAB, SETTINGS_TABS, SETTINGS_TABS_LABEL } from "../_ui/settings-tabs";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

/** ADR-058: title riêng theo tab. */
export const metadata: Metadata = { title: "Cấu hình Email (SMTP) — Cấu hình chung" };

export default async function AdminSmtpSettingsPage() {
  await requireAdminAccess("/admin/settings/smtp");

  const prisma = getPrismaClient();
  const [config, logRows, brand] = await Promise.all([
    getSystemSmtpConfig(),
    prisma.emailSendLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    getEffectiveBrand(),
  ]);

  return (
    // ADR-058: tab "Cấu hình Email (SMTP)" của nhóm Cấu hình chung — h1 là tên nhóm. Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Cấu hình chung"
        subtitle="Cấu hình Email (SMTP) — máy chủ SMTP gửi email hệ thống (xác thực, reset mật khẩu, thông báo billing...) — bắt đầu với Gmail SMTP. Mật khẩu mã hoá AES-256-GCM."
        action={
          <div className="flex items-center gap-3">
            <Badge tone={config?.isEnabled ? "success" : "neutral"}>{config?.isEnabled ? "Đang hoạt động" : "Đang tắt"}</Badge>
            <RefreshButton />
          </div>
        }
      />
      <ModuleTabs label={SETTINGS_TABS_LABEL} items={SETTINGS_TABS} current={SETTINGS_SMTP_TAB} />

      <SmtpTabs
        initial={{
          host: config?.publicConfig.host ?? "",
          port: config?.publicConfig.port ?? 587,
          secure: config?.publicConfig.secure ?? false,
          username: config?.publicConfig.username ?? "",
          // Chưa đặt From Name → gợi ý tên thương hiệu hiệu lực (ADR-032), không hard-code.
          fromName: config?.publicConfig.fromName || brand.name,
          fromEmail: config?.publicConfig.fromEmail ?? "",
          replyTo: config?.publicConfig.replyTo ?? "",
          isEnabled: config?.isEnabled ?? false,
          maskedPassword: config?.maskedSecrets.password,
          lastVerifiedAt: config?.lastVerifiedAt
            ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })
            : null,
        }}
        log={logRows.map((row) => ({
          id: row.id,
          type: row.type,
          recipient: row.recipient,
          subject: row.subject,
          status: row.status,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE }),
        }))}
      />
    </div>
  );
}
