import type { Metadata } from "next";
import { getBrand } from "@gieochu/config/brand";
import { getActivePlans } from "../../lib/pricing";

export const metadata: Metadata = {
  title: "Bảng giá",
};

export default async function PricingPage() {
  const brand = getBrand();
  const plans = await getActivePlans();

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">Bảng giá</h1>
      <p className="mt-2 text-gray-600">Chọn gói phù hợp để mở trang bán tài liệu trên {brand.name}.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded border p-6">
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
            <ul className="mt-4 space-y-1 text-sm text-gray-600">
              <li>Tối đa {plan.maxProducts} sản phẩm</li>
              <li>{plan.storageMb.toLocaleString("vi-VN")} MB dung lượng</li>
              <li>File tối đa {plan.maxFileMb} MB</li>
            </ul>
          </div>
        ))}
      </div>

      {plans.length === 0 ? <p className="mt-8 text-sm text-gray-500">Chưa có gói dịch vụ nào.</p> : null}
    </main>
  );
}
