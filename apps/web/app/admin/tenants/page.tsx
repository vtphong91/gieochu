import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../../lib/page-guards";
import { listAdminTenants } from "../../../lib/admin-tenant-detail";
import { countOverdueRefundRequestsByTenant } from "../../../lib/entitlement-remedy";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../_ui/kit";
import { IconLayers } from "../_ui/icons";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";
import { formatVndFull } from "../_ui/stats-chart";
import { TENANT_STATUS_LABEL, TENANT_STATUS_TONE } from "./_ui/tenant-labels";
import { TenantRowActions } from "./_ui/tenant-lock-dialog";

const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/tenants");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  // ADR-072: chủ gian hàng + GMV 30 ngày (tenant_daily_stats) + số tài liệu (đếm qua withSystemJob) — lib/admin-tenant-detail.ts.
  const { items: tenants, total } = await listAdminTenants({ skip, take });
  // ADR-039 mục 3 + §7.9: chỉ số đếm yêu cầu hoàn tiền quá hạn theo tenant.
  const overdueRefunds = new Map((await countOverdueRefundRequestsByTenant()).map((row) => [row.tenantId, row.count]));

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Gian hàng"
        subtitle="Không có màn hình đơn hàng/khách hàng của gian hàng (§4.2) — chỉ số liệu tổng hợp. GMV là tổng 30 ngày gần nhất, tính đến hết hôm qua."
      />

      <div className="mt-6">
        {tenants.length === 0 ? (
          <EmptyState icon={<IconLayers className="h-6 w-6" />} title="Chưa có gian hàng nào" />
        ) : (
          <>
            <DataTable
              caption="Danh sách gian hàng"
              head={[
                "Trang",
                "Gói hiện tại",
                "Trạng thái",
                "Dung lượng đã dùng",
                "Số sản phẩm",
                <span key="gmv">
                  GMV <span className="block text-xs font-normal">30 ngày</span>
                </span>,
                <span key="act" className="sr-only">
                  Thao tác
                </span>,
              ]}
              headClassName={[undefined, undefined, undefined, HIDE_BELOW_LG, HIDE_BELOW_LG, `${HIDE_BELOW_MD} text-right`, "text-right"]}
            >
              {tenants.map((tenant) => {
                const overdue = overdueRefunds.get(tenant.id);
                return (
                  <Tr key={tenant.id}>
                    <Td className="font-medium">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] [overflow-wrap:anywhere]"
                        style={{ color: brandColors.primary }}
                      >
                        {tenant.name}
                      </Link>{" "}
                      <span className="text-gray-500 [overflow-wrap:anywhere]">/{tenant.slug}</span>
                      <span className="mt-0.5 block text-xs font-normal text-gray-500 [overflow-wrap:anywhere]">
                        <span className="sr-only">Chủ gian hàng: </span>
                        {tenant.owner.fullName ?? tenant.owner.email}
                      </span>
                      {/* Dưới md cột GMV ẩn → lặp ở đây. */}
                      <span className="mt-0.5 block text-xs font-normal text-gray-500 tabular-nums md:hidden">
                        GMV 30 ngày: {formatVndFull(tenant.gmv30dVnd)}
                      </span>
                      {overdue ? (
                        <span className="mt-1 block">
                          <Badge tone="danger">{overdue} hoàn tiền quá hạn</Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td>{tenant.planName ?? "—"}</Td>
                    <Td>
                      <Badge tone={TENANT_STATUS_TONE[tenant.status] ?? "neutral"}>{TENANT_STATUS_LABEL[tenant.status] ?? tenant.status}</Badge>
                    </Td>
                    <Td className={`text-gray-500 ${HIDE_BELOW_LG}`}>{Math.round(tenant.storageUsedBytes / 1024 / 1024)} MB</Td>
                    <Td className={`text-gray-500 ${HIDE_BELOW_LG}`}>{tenant.productCount}</Td>
                    <Td className={`text-right whitespace-nowrap tabular-nums ${HIDE_BELOW_MD}`}>{formatVndFull(tenant.gmv30dVnd)}</Td>
                    <Td className="text-right">
                      <TenantRowActions tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status }} />
                    </Td>
                  </Tr>
                );
              })}
            </DataTable>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </div>
  );
}
