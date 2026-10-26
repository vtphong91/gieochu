import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listCoupons } from "../../../../lib/coupon";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryLinkButton, Td, Tr } from "../../../admin/_ui/kit";
import { IconPlus, IconTag } from "../../../admin/_ui/icons";

export default async function StudioCouponsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/coupons`);

  const coupons = await listCoupons(tenant.id);

  return (
    // Wrapper <div>: layout Studio đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Mã giảm giá"
        subtitle="Quản lý mã khuyến mãi cho khách hàng."
        action={
          <PrimaryLinkButton href={`/studio/${tenantSlug}/coupons/new`}>
            <IconPlus className="h-4 w-4" /> Tạo mã
          </PrimaryLinkButton>
        }
      />

      <div className="mt-6">
        {coupons.length === 0 ? (
          <EmptyState icon={<IconTag className="h-6 w-6" />} title="Chưa có mã giảm giá nào" />
        ) : (
          <DataTable head={["Mã", "Giá trị", "Đã dùng", "Trạng thái"]}>
            {coupons.map((coupon) => (
              <Tr key={coupon.id}>
                <Td>
                  <Link href={`/studio/${tenantSlug}/coupons/${coupon.id}`} className="font-mono text-sm font-semibold hover:underline">
                    {coupon.code}
                  </Link>
                </Td>
                <Td className="text-gray-500">{coupon.type === "PERCENT" ? `${coupon.value}%` : `${coupon.value.toLocaleString("vi-VN")}đ`}</Td>
                <Td className="text-gray-500">
                  {coupon.usedCount}
                  {coupon.usageLimit != null ? `/${coupon.usageLimit}` : ""}
                </Td>
                <Td>
                  <Badge tone={coupon.isEnabled ? "success" : "neutral"}>{coupon.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
