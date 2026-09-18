import { getEnv } from "@gieochu/config";
import { buildWebhookNotifyUrl } from "@gieochu/payments";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { listBankBins } from "../../../../lib/tenant-payment";
import { listPlatformProviderConfigs } from "../../../../lib/platform-payment";
import { ManualQrForm } from "./manual-qr-form";
import { SepayForm } from "./sepay-form";
import { MomoForm } from "./momo-form";

export default async function AdminBillingPaymentPage() {
  await requireAdminAccess("/admin/billing/payment");

  const [banks, configs] = await Promise.all([listBankBins(), listPlatformProviderConfigs()]);

  const manualQr = configs.find((c) => c.provider === "MANUAL_QR");
  const sepay = configs.find((c) => c.provider === "SEPAY");
  const momo = configs.find((c) => c.provider === "MOMO");

  const env = getEnv();
  const webhookUrl = buildWebhookNotifyUrl(env.APP_URL, { kind: "PLATFORM" }, "SEPAY");

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Tài khoản thu phí SaaS</h1>
      <p className="mt-2 text-sm text-gray-500">
        Cấu hình tài khoản ngân hàng của Tani dùng để thu phí gói dịch vụ từ các tenant.
      </p>

      <div className="mt-6 space-y-6">
        <ManualQrForm
          banks={banks}
          initial={{
            bankBin: String(manualQr?.publicConfig.bankBin ?? ""),
            accountNo: String(manualQr?.publicConfig.accountNo ?? ""),
            accountName: String(manualQr?.publicConfig.accountName ?? ""),
            isEnabled: manualQr?.isEnabled ?? false,
          }}
        />

        <SepayForm
          banks={banks}
          webhookUrl={webhookUrl}
          initial={{
            bankBin: String(sepay?.publicConfig.bankBin ?? ""),
            accountNo: String(sepay?.publicConfig.accountNo ?? ""),
            accountName: String(sepay?.publicConfig.accountName ?? ""),
            authType: String(sepay?.publicConfig.authType ?? "HMAC_SHA256"),
            paymentPrefix: String(sepay?.publicConfig.paymentPrefix ?? "SUB"),
            isEnabled: sepay?.isEnabled ?? false,
            maskedSecret: sepay?.maskedSecrets.secret,
          }}
        />

        <MomoForm
          initial={{
            partnerCode: String(momo?.publicConfig.partnerCode ?? ""),
            accessKey: String(momo?.publicConfig.accessKey ?? ""),
            environment: String(momo?.publicConfig.environment ?? "sandbox"),
            isEnabled: momo?.isEnabled ?? false,
            maskedSecret: momo?.maskedSecrets.secretKey,
            lastVerifiedAt: momo?.lastVerifiedAt
              ? momo.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              : null,
          }}
        />
      </div>
    </main>
  );
}
