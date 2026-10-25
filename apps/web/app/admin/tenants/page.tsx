import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { countOverdueRefundRequestsByTenant } from "../../../lib/entitlement-remedy";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../_ui/kit";
import { IconLayers, IconLock, IconUnlock } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";
import { lockTenantAction, unlockTenantAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Hoạt động",
  READ_ONLY: "Tạm ngưng bán",
  LOCKED: "Đã khoá",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  READ_ONLY: "warning",
  LOCKED: "danger",
};

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/tenants");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const prisma = getPrismaClient();
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.tenant.count(),
  ]);
  // ADR-039 mục 3 + §7.9: chỉ số đếm yêu cầu hoàn tiền quá hạn theo tenant.
  const overdueRefunds = new Map((await countOverdueRefundRequestsByTenant()).map((row) => [row.tenantId, row.count]));

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Tenant" subtitle="Không có màn hình đơn hàng/khách hàng của tenant (§4.2) — chỉ số liệu tổng hợp." />

      <div className="mt-6">
        {tenants.length === 0 ? (
          <EmptyState icon={<IconLayers className="h-6 w-6" />} title="Chưa có tenant nào" />
        ) : (
          <>
            <DataTable head={["Trang", "Gói hiện tại", "Trạng thái", "Dung lượng đã dùng", "Số sản phẩm", "GMV", ""]}>
              {tenants.map((tenant) => (
                <Tr key={tenant.id}>
                  <Td className="font-medium">
                    {tenant.name} <span className="text-gray-500">/{tenant.slug}</span>
                    {overdueRefunds.get(tenant.id) ? (
                      <span className="mt-1 block">
                        <Badge tone="danger">{overdueRefunds.get(tenant.id)} hoàn tiền quá hạn</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td>{tenant.subscription?.plan.name ?? "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[tenant.status] ?? "neutral"}>{STATUS_LABEL[tenant.status] ?? tenant.status}</Badge>
                  </Td>
                  <Td className="text-gray-500">{Math.round(tenant.storageUsedBytes / 1024 / 1024)} MB</Td>
                  <Td className="text-gray-500">{tenant._count.products}</Td>
                  <Td className="text-gray-400">Cần M12</Td>
                  <Td>
                    <RowMenu label={`Chức năng cho ${tenant.name}`}>
                      {tenant.status === "LOCKED" ? (
                        <form action={unlockTenantAction.bind(null, tenant.id)}>
                          <MenuItemButton tone="success" icon={<IconUnlock />}>
                            Mở khoá tenant
                          </MenuItemButton>
                        </form>
                      ) : (
                        <form action={lockTenantAction.bind(null, tenant.id)}>
                          <MenuItemButton tone="danger" icon={<IconLock />}>
                            Khoá tenant
                          </MenuItemButton>
                        </form>
                      )}
                    </RowMenu>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </div>
  );
}
