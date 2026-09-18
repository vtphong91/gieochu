import { getEnv } from "@gieochu/config";
import { buildWebhookNotifyUrl } from "@gieochu/payments";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listBankBins, listTenantProviderConfigs } from "../../../../../lib/tenant-payment";
import { ManualQrForm } from "./manual-qr-form";
import { SepayForm } from "./sepay-form";
import { MomoForm } from "./momo-form";

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
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Cấu hình thanh toán</h1>
      <p className="mt-2 text-sm text-gray-500">
        Bật ít nhất một phương thức để xuất bản sản phẩm có giá &gt; 0. Tiền về thẳng tài khoản của bạn.
      </p>

      <div className="mt-6 space-y-6">
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
      </div>
    </main>
  );
}
