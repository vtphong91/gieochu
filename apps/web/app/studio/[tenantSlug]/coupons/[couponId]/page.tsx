import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getCoupon } from "../../../../../lib/coupon";
import { listProducts } from "../../../../../lib/product";
import { CouponForm } from "../coupon-form";
import { updateCouponAction } from "../actions";

/** Wall-clock time in Asia/Ho_Chi_Minh for a `datetime-local` input's defaultValue — same helper as the product edit page. */
function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; couponId: string }>;
}) {
  const { tenantSlug, couponId } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/coupons/${couponId}`);

  let coupon;
  try {
    coupon = await getCoupon(tenant.id, couponId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }
  const products = await listProducts(tenant.id);
  const productIds = (coupon.productIds as string[] | null) ?? [];

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Sửa mã &quot;{coupon.code}&quot;</h1>
      <p className="mt-1 text-sm text-gray-500">
        Đã dùng {coupon.usedCount}
        {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ""} lượt.
      </p>
      <div className="mt-6">
        <CouponForm
          action={updateCouponAction.bind(null, tenantSlug, couponId)}
          submitLabel="Lưu"
          products={products.map((p) => ({ id: p.id, title: p.title }))}
          initial={{
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            maxDiscountVnd: coupon.maxDiscountVnd?.toString() ?? "",
            minOrderVnd: coupon.minOrderVnd?.toString() ?? "",
            usageLimit: coupon.usageLimit?.toString() ?? "",
            perCustomerLimit: coupon.perCustomerLimit?.toString() ?? "",
            startsAt: toDatetimeLocal(coupon.startsAt),
            endsAt: toDatetimeLocal(coupon.endsAt),
            productIds,
            isEnabled: coupon.isEnabled,
          }}
        />
      </div>
    </main>
  );
}
