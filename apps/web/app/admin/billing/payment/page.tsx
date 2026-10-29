import { getEffectiveBrand } from "../../../../lib/branding";
import { getEnv } from "@gieochu/config";
import { buildWebhookNotifyUrl } from "@gieochu/payments";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { listBankBins } from "../../../../lib/tenant-payment";
import { listPlatformProviderConfigs } from "../../../../lib/platform-payment";
import { AdminPageHeader, Badge } from "../../_ui/kit";
import { ManualQrForm } from "./manual-qr-form";
import { SepayForm } from "./sepay-form";
import { MomoForm } from "./momo-form";
import { MomoManualForm } from "./momo-manual-form";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

const COMING_SOON = [
  { name: "VNPay", desc: "Cổng thanh toán nội địa — hỗ trợ hầu hết ngân hàng Việt Nam." },
  { name: "Stripe", desc: "Thẻ tín dụng / ghi nợ quốc tế." },
];

export default async function AdminBillingPaymentPage() {
  await requireAdminAccess("/admin/billing/payment");
  const brand = await getEffectiveBrand();

  const [banks, configs] = await Promise.all([listBankBins(), listPlatformProviderConfigs()]);

  const manualQr = configs.find((c) => c.provider === "MANUAL_QR");
  const sepay = configs.find((c) => c.provider === "SEPAY");
  const momo = configs.find((c) => c.provider === "MOMO");
  const momoManual = configs.find((c) => c.provider === "MOMO_MANUAL");

  const env = getEnv();
  const webhookUrl = buildWebhookNotifyUrl(env.APP_URL, { kind: "PLATFORM" }, "SEPAY");

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Tài khoản thu phí SaaS"
        subtitle={`Tài khoản ngân hàng của ${brand.name} dùng để thu phí gói dịch vụ từ các tenant — hoàn toàn khác với thanh toán khách hàng ↔ tenant (cấu hình riêng theo từng tenant).`}
      />

      {/* ADR-058 (task 1.11): mỗi cổng là một khối thu gọn (cổng đang bật mở sẵn) — xếp 1 cột để khối thu gọn không lệch
          hàng với khối đang mở; giới hạn bề ngang cho dễ đọc form. */}
      <div className="mt-6 space-y-4">
        <ManualQrForm
          banks={banks}
          initial={{
            bankBin: String(manualQr?.publicConfig.bankBin ?? ""),
            accountNo: String(manualQr?.publicConfig.accountNo ?? ""),
            accountName: String(manualQr?.publicConfig.accountName ?? ""),
            isEnabled: manualQr?.isEnabled ?? false,
          }}
        />

        {/* ADR-059 bổ sung lần 3 — bật song song được với chuyển khoản ngân hàng. */}
        <MomoManualForm
          initial={{
            phone: String(momoManual?.publicConfig.phone ?? ""),
            accountName: String(momoManual?.publicConfig.accountName ?? ""),
            isEnabled: momoManual?.isEnabled ?? false,
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
              ? momo.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })
              : null,
          }}
        />

        {COMING_SOON.map((p) => (
          <section key={p.name} className="rounded-2xl border border-dashed bg-white/60 px-4 py-4 sm:px-6" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-heading)] font-semibold text-gray-500">{p.name}</h2>
              <Badge tone="neutral">Sắp ra mắt</Badge>
            </div>
            <p className="mt-1.5 text-sm text-gray-400">{p.desc}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border bg-gray-50 p-5 text-sm text-gray-600" style={{ borderColor: "#E5E7EB" }}>
        <p className="font-medium text-gray-800">Bảo mật thông tin</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Secret/API key được mã hoá AES-256-GCM trước khi lưu vào cơ sở dữ liệu.</li>
          <li>Key đã lưu không bao giờ hiển thị lại — hệ thống chỉ cho biết đã cấu hình hay chưa. Nhập key mới để ghi đè.</li>
        </ul>
      </div>
    </div>
  );
}
