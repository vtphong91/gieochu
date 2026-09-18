import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listCoupons } from "../../../../lib/coupon";

export default async function StudioCouponsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/coupons`);

  const coupons = await listCoupons(tenant.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mã giảm giá</h1>
        <Link href={`/studio/${tenantSlug}/coupons/new`} className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white">
          + Tạo mã
        </Link>
      </div>

      <ul className="mt-6 divide-y rounded border">
        {coupons.length === 0 ? <li className="p-4 text-sm text-gray-500">Chưa có mã giảm giá nào.</li> : null}
        {coupons.map((coupon) => (
          <li key={coupon.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <Link href={`/studio/${tenantSlug}/coupons/${coupon.id}`} className="font-medium hover:underline">
                {coupon.code}
              </Link>
              <p className="text-gray-500">
                {coupon.type === "PERCENT" ? `${coupon.value}%` : `${coupon.value.toLocaleString("vi-VN")}đ`}
                {" · "}Đã dùng {coupon.usedCount}
                {coupon.usageLimit != null ? `/${coupon.usageLimit}` : ""}
              </p>
            </div>
            <span>{coupon.isEnabled ? "Đang bật" : "Đang tắt"}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
