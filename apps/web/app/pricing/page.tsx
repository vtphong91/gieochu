import type { Metadata } from "next";
import { getBrand } from "@gieochu/config/brand";
import { getActivePlans } from "../../lib/pricing";

export const metadata: Metadata = {
  title: "Bảng giá",
};

const FEATURE_LABELS: Record<string, string> = {
  coupons: "Mã giảm giá",
  advancedAnalytics: "Thống kê nâng cao",
  advancedBranding: "Thương hiệu nâng cao",
  seoTools: "Công cụ SEO",
  automation: "Tự động hoá",
  customDomain: "Tên miền riêng",
};

export default async function PricingPage() {
  const brand = getBrand();
  const plans = await getActivePlans();

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">Bảng giá</h1>
      <p className="mt-2 text-gray-600">
        Bắt đầu miễn phí trên {brand.name}. Chỉ nâng cấp khi bạn cần nhiều hơn.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const features = plan.features as Record<string, boolean> | null;
          const activeFeatures = Object.entries(FEATURE_LABELS).filter(([key]) => features?.[key] === true);
          return (
            <div key={plan.id} className={`rounded border p-6 ${plan.isFree ? "border-[var(--color-primary)]" : ""}`}>
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2 text-2xl font-bold">
                {plan.priceVnd === 0 ? "Miễn phí" : `${plan.priceVnd.toLocaleString("vi-VN")}đ`}
                {plan.priceVnd > 0 ? (
                  <span className="text-sm font-normal text-gray-500">
                    {" "}
                    / {plan.intervalCount} {plan.interval === "MONTH" ? "tháng" : "năm"}
                  </span>
                ) : null}
              </p>
              {plan.isFree ? <p className="mt-1 text-xs text-[var(--color-primary)]">Không bao giờ hết hạn</p> : null}
              <ul className="mt-4 space-y-1 text-sm text-gray-600">
                <li>Tối đa {plan.maxProducts} sản phẩm</li>
                <li>{plan.storageMb.toLocaleString("vi-VN")} MB dung lượng</li>
                <li>File tối đa {plan.maxFileMb} MB</li>
                {activeFeatures.map(([key, label]) => (
                  <li key={key}>{label}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {plans.length === 0 ? <p className="mt-8 text-sm text-gray-500">Chưa có gói dịch vụ nào.</p> : null}
    </main>
  );
}
