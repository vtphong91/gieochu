import { getEnv } from "@gieochu/config";
import { buildWebhookNotifyUrl } from "@gieochu/payments";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listBankBins, listTenantProviderConfigs } from "../../../../../lib/tenant-payment";
import { ManualQrForm } from "./manual-qr-form";
import { SepayForm } from "./sepay-form";
import { MomoForm } from "./momo-form";
import { AdminPageHeader, SettingsGrid } from "../../../../admin/_ui/kit";

export default async function StudioPaymentsSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/settings/payments`);

  const [banks, configs] = await Promise.all([listBankBins(), listTenantProviderConfigs(tenant.id)]);

  const manualQr = configs.find((c) => c.provider === "MANUAL_QR");
  const sepay = configs.find((c) => c.provider === "SEPAY");
  const momo = configs.find((c) => c.provider === "MOMO");

  const env = getEnv();
  const webhookUrl = buildWebhookNotifyUrl(env.APP_URL, { kind: "TENANT", tenantId: tenant.id }, "SEPAY");

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Cấu hình thanh toán"
        subtitle="Bật ít nhất một phương thức để xuất bản sản phẩm có giá > 0. Tiền về thẳng tài khoản của bạn."
      />

      <SettingsGrid>
        <ManualQrForm
          tenantSlug={tenant.slug}
          banks={banks}
          initial={{
            bankBin: String(manualQr?.publicConfig.bankBin ?? ""),
            accountNo: String(manualQr?.publicConfig.accountNo ?? ""),
            accountName: String(manualQr?.publicConfig.accountName ?? ""),
            isEnabled: manualQr?.isEnabled ?? false,
          }}
        />

        <SepayForm
          tenantSlug={tenant.slug}
          banks={banks}
          webhookUrl={webhookUrl}
          initial={{
            bankBin: String(sepay?.publicConfig.bankBin ?? ""),
            accountNo: String(sepay?.publicConfig.accountNo ?? ""),
            accountName: String(sepay?.publicConfig.accountName ?? ""),
            authType: String(sepay?.publicConfig.authType ?? "HMAC_SHA256"),
            paymentPrefix: String(sepay?.publicConfig.paymentPrefix ?? tenant.orderCodePrefix),
            isEnabled: sepay?.isEnabled ?? false,
            maskedSecret: sepay?.maskedSecrets.secret,
          }}
        />

        <MomoForm
          tenantSlug={tenant.slug}
          initial={{
            partnerCode: String(momo?.publicConfig.partnerCode ?? ""),
            accessKey: String(momo?.publicConfig.accessKey ?? ""),
            environment: String(momo?.publicConfig.environment ?? "sandbox"),
            isEnabled: momo?.isEnabled ?? false,
            maskedSecret: momo?.maskedSecrets.secretKey,
          }}
        />
      </SettingsGrid>

      <div className="mt-8 rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600" style={{ borderColor: "#E5E7EB" }}>
        <p className="font-medium text-gray-800">Bảo mật thông tin</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Secret/API key được mã hoá AES-256-GCM trước khi lưu vào cơ sở dữ liệu.</li>
          <li>Key đã lưu không bao giờ hiển thị lại — hệ thống chỉ cho biết đã cấu hình hay chưa. Nhập key mới để ghi đè.</li>
        </ul>
      </div>
    </main>
  );
}
