import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import type { Prisma } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { escapeContainsValue } from "../../../lib/prisma-contains";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../_ui/kit";
import { IconLock, IconUnlock, IconUsers } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";
import { lockUserAction, unlockUserAction } from "./actions";
import { ResendVerificationMenuItem } from "./resend-verification-item";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ kích hoạt",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khoá",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  PENDING: "warning",
  LOCKED: "danger",
};

type RoleFilter = "all" | "admin" | "owner" | "other";

const TABS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Chủ gian hàng" },
  { value: "other", label: "Người dùng khác" },
];

function roleWhere(role: RoleFilter): Prisma.UserWhereInput {
  if (role === "admin") return { systemRole: "SYSTEM_ADMIN" };
  if (role === "owner") return { ownedTenant: { isNot: null } };
  if (role === "other") return { systemRole: "USER", ownedTenant: null };
  return {};
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/users");
  const sp = await searchParams;
  const role: RoleFilter = TABS.some((t) => t.value === sp.role) ? (sp.role as RoleFilter) : "all";
  const { page, pageSize, skip, take } = parsePagination(sp);

  const prisma = getPrismaClient();
  const where: Prisma.UserWhereInput = {
    ...roleWhere(role),
    ...(sp.q ? { email: { contains: escapeContainsValue(sp.q), mode: "insensitive" } } : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { profile: true, ownedTenant: { select: { name: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Người dùng" subtitle={`Tổng: ${total.toLocaleString("vi-VN")} tài khoản`} />

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.value === role;
          const href = `/admin/users${tab.value === "all" ? "" : `?role=${tab.value}`}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
              style={active ? { background: "#D97706", color: "white" } : { background: "white", color: "#4B5563", border: "1px solid #E5E7EB" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <form className="mt-4 flex gap-2">
        {role !== "all" ? <input type="hidden" name="role" value={role} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={sp.q}
          placeholder="Tìm theo tên, email, SĐT..."
          className="w-full max-w-sm rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
          style={{ borderColor: "#E5E7EB" }}
        />
        <button
          type="submit"
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
          style={{ borderColor: "#E5E7EB", color: "#12213A" }}
        >
          Tìm
        </button>
      </form>

      <div className="mt-4">
        {users.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Không tìm thấy người dùng nào" description={sp.q ? `Không có email nào khớp "${sp.q}".` : undefined} />
        ) : (
          <>
            <DataTable head={["Họ tên", "Vai trò", "Gian hàng", "Trạng thái", "Email", "Ngày tạo", ""]}>
              {users.map((user) => (
                <Tr key={user.id}>
                  <Td className="font-medium">{user.profile?.fullName ?? "—"}</Td>
                  <Td>
                    <Badge tone={user.isSuperAdmin ? "info" : user.systemRole === "SYSTEM_ADMIN" ? "info" : user.ownedTenant ? "success" : "neutral"}>
                      {user.isSuperAdmin ? "Super admin" : user.systemRole === "SYSTEM_ADMIN" ? "Admin" : user.ownedTenant ? "Chủ gian hàng" : "Người dùng"}
                    </Badge>
                  </Td>
                  <Td className="text-gray-500">{user.ownedTenant?.name ?? "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[user.status] ?? "neutral"}>{STATUS_LABEL[user.status] ?? user.status}</Badge>
                  </Td>
                  <Td className="text-gray-500">{user.email}</Td>
                  <Td className="text-gray-500">{user.createdAt.toLocaleDateString("vi-VN")}</Td>
                  <Td>
                    <RowMenu label={`Chức năng cho ${user.email}`}>
                      {user.status === "LOCKED" ? (
                        <form action={unlockUserAction.bind(null, user.id)}>
                          <MenuItemButton tone="success" icon={<IconUnlock />}>
                            Mở khoá tài khoản
                          </MenuItemButton>
                        </form>
                      ) : (
                        <form action={lockUserAction.bind(null, user.id)}>
                          <MenuItemButton tone="danger" icon={<IconLock />}>
                            Khoá tài khoản
                          </MenuItemButton>
                        </form>
                      )}
                      {user.status === "PENDING" ? <ResendVerificationMenuItem userId={user.id} /> : null}
                    </RowMenu>
                  </Td>
                </Tr>
              ))}
            </DataTable>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </main>
  );
}
