import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listProducts } from "../../../../../lib/product";
import { CouponForm } from "../coupon-form";
import { createCouponAction } from "../actions";
import { AdminPageHeader } from "../../../../admin/_ui/kit";

export default async function NewCouponPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/coupons/new`);

  const products = await listProducts(tenant.id);

  return (
    // Wrapper <div>: layout Studio đã có <main>. Full width theo khung app.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Tạo mã giảm giá" subtitle="Thiết lập điều kiện áp dụng và giới hạn sử dụng." />
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
    </div>
  );
}
