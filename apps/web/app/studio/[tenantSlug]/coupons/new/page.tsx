import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listProducts } from "../../../../../lib/product";
import { CouponForm } from "../coupon-form";
import { createCouponAction } from "../actions";

export default async function NewCouponPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/coupons/new`);

  const products = await listProducts(tenant.id);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo mã giảm giá</h1>
      <div className="mt-6">
        <CouponForm
          action={createCouponAction.bind(null, tenantSlug)}
          submitLabel="Tạo mã"
          products={products.map((p) => ({ id: p.id, title: p.title }))}
          initial={{
            code: "",
            type: "PERCENT",
            value: 10,
            maxDiscountVnd: "",
            minOrderVnd: "",
            usageLimit: "",
            perCustomerLimit: "",
            startsAt: "",
            endsAt: "",
            productIds: [],
            isEnabled: true,
          }}
        />
      </div>
    </main>
  );
}
