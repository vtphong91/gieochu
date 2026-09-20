import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { togglePlanActiveAction } from "./actions";
import { AdminPageHeader, Badge, DataTable, GhostLinkButton, PrimaryLinkButton, SettingsGrid, Td, Tr } from "../_ui/kit";
import { IconEdit, IconPlus, IconToggleOff, IconToggleOn } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { CreatePlanForm } from "./create-plan-form";

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireAdminAccess("/admin/plans");
  const { new: newParam } = await searchParams;
  const isCreating = newParam === "1";

  const prisma = getPrismaClient();
  const plans = await prisma.plan.findMany({ orderBy: { priceVnd: "asc" } });

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Gói dịch vụ"
        subtitle="Quản lý các gói subscription — giới hạn, giá, tính năng theo từng gói."
        action={
          isCreating ? (
            <GhostLinkButton href="/admin/plans">Đóng</GhostLinkButton>
          ) : (
            <PrimaryLinkButton href="/admin/plans?new=1">
              <IconPlus className="h-4 w-4" />
              Thêm gói mới
            </PrimaryLinkButton>
          )
        }
      />

      <div className="mt-6">
        <DataTable head={["Mã", "Tên", "Giá", "Chu kỳ", "Trạng thái", ""]}>
          {plans.map((plan) => (
            <Tr key={plan.id}>
              <Td className="font-mono text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  {plan.code}
                  {plan.isFree ? <Badge tone="success">FREE</Badge> : null}
                </div>
              </Td>
              <Td>
                <Link href={`/admin/plans/${plan.id}`} className="font-medium hover:underline">
                  {plan.name}
                </Link>
              </Td>
              <Td>{plan.priceVnd.toLocaleString("vi-VN")}đ</Td>
              <Td className="text-gray-500">
                {plan.intervalCount} {plan.interval === "MONTH" ? "tháng" : "năm"}
              </Td>
              <Td>
                <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Đang bật" : "Đã tắt"}</Badge>
              </Td>
              <Td>
                <RowMenu label={`Chức năng cho gói ${plan.name}`}>
                  <Link href={`/admin/plans/${plan.id}`}>
                    <MenuItemButton type="button" icon={<IconEdit />}>
                      Sửa gói
                    </MenuItemButton>
                  </Link>
                  <form action={togglePlanActiveAction.bind(null, plan.id)}>
                    <MenuItemButton tone={plan.isActive ? "danger" : "success"} icon={plan.isActive ? <IconToggleOff /> : <IconToggleOn />}>
                      {plan.isActive ? "Tắt gói" : "Bật gói"}
                    </MenuItemButton>
                  </form>
                </RowMenu>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      {isCreating ? (
        <div className="mt-8">
          <h2 className="font-[family-name:var(--font-heading)] mb-3 font-semibold">Tạo gói mới</h2>
          <SettingsGrid>
            <CreatePlanForm />
          </SettingsGrid>
        </div>
      ) : null}
    </main>
  );
}
