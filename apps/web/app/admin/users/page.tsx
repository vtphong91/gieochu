import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import type { Prisma } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { escapeContainsValue } from "../../../lib/prisma-contains";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../_ui/kit";
import { formatAdminDate } from "../_ui/billing-labels";
import { IconUsers } from "../_ui/icons";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";
import { USER_ROLE_LABEL, USER_ROLE_TONE, USER_STATUS_LABEL, USER_STATUS_TONE, resolveUserRole } from "./_ui/user-labels";
import { UserRowActions } from "./_ui/user-row-actions";

const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";

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
  const admin = await requireAdminAccess("/admin/users");
  const sp = await searchParams;
  const role: RoleFilter = TABS.some((t) => t.value === sp.role) ? (sp.role as RoleFilter) : "all";
  const { page, pageSize, skip, take } = parsePagination(sp);

  const prisma = getPrismaClient();
  // ADR-074: tìm theo email HOẶC họ tên (user_profiles.fullName); không tìm theo SĐT.
  const q = sp.q?.trim();
  const keyword = q ? escapeContainsValue(q) : null;
  const where: Prisma.UserWhereInput = {
    ...roleWhere(role),
    ...(keyword
      ? {
          OR: [
            { email: { contains: keyword, mode: "insensitive" } },
            { profile: { is: { fullName: { contains: keyword, mode: "insensitive" } } } },
          ],
        }
      : {}),
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
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
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
          placeholder="Tìm theo tên hoặc email..."
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
          <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Không tìm thấy người dùng nào" description={sp.q ? `Không có tên hoặc email nào khớp "${sp.q}".` : undefined} />
        ) : (
          <>
            <DataTable
              caption="Danh sách người dùng"
              head={[
                "Người dùng",
                "Vai trò",
                "Gian hàng",
                "Trạng thái",
                "Ngày tạo",
                <span key="act" className="sr-only">
                  Thao tác
                </span>,
              ]}
              headClassName={[undefined, HIDE_BELOW_MD, HIDE_BELOW_LG, HIDE_BELOW_MD, HIDE_BELOW_LG, "text-right"]}
            >
              {users.map((user) => {
                const fullName = user.profile?.fullName ?? null;
                const displayName = fullName ?? user.email;
                const userRole = resolveUserRole({ isSuperAdmin: user.isSuperAdmin, systemRole: user.systemRole, hasOwnedTenant: user.ownedTenant !== null });
                const ownedTenantName = user.ownedTenant?.name ?? null;
                // Cờ để ẩn/hiện mục menu; server kiểm lại khi thực hiện (không tự khoá mình, không khoá siêu quản trị).
                const protectedTarget = user.isSuperAdmin || user.id === admin.userId;
                return (
                  <Tr key={user.id}>
                    <Td className="font-medium">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] [overflow-wrap:anywhere]"
                        style={{ color: brandColors.primary }}
                      >
                        {displayName}
                      </Link>
                      {fullName ? <span className="mt-0.5 block text-xs font-normal text-gray-500 [overflow-wrap:anywhere]">{user.email}</span> : null}
                      {/* Dưới lg cột Gian hàng ẩn → lặp ở đây. */}
                      {ownedTenantName ? (
                        <span className="mt-0.5 block text-xs font-normal text-gray-500 [overflow-wrap:anywhere] lg:hidden">Gian hàng: {ownedTenantName}</span>
                      ) : null}
                      {/* Dưới md các cột Vai trò / Trạng thái ẩn → lặp ở đây. */}
                      <span className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                        <Badge tone={USER_ROLE_TONE[userRole]}>{USER_ROLE_LABEL[userRole]}</Badge>
                        <Badge tone={USER_STATUS_TONE[user.status]}>{USER_STATUS_LABEL[user.status]}</Badge>
                      </span>
                    </Td>
                    <Td className={HIDE_BELOW_MD}>
                      <Badge tone={USER_ROLE_TONE[userRole]}>{USER_ROLE_LABEL[userRole]}</Badge>
                    </Td>
                    <Td className={`text-gray-500 [overflow-wrap:anywhere] ${HIDE_BELOW_LG}`}>{ownedTenantName ?? "—"}</Td>
                    <Td className={HIDE_BELOW_MD}>
                      <Badge tone={USER_STATUS_TONE[user.status]}>{USER_STATUS_LABEL[user.status]}</Badge>
                    </Td>
                    <Td className={`text-gray-500 ${HIDE_BELOW_LG}`}>{formatAdminDate(user.createdAt)}</Td>
                    <Td className="text-right">
                      <UserRowActions
                        user={{ id: user.id, name: displayName, email: user.email, status: user.status, ownedTenantName }}
                        canLock={user.status !== "LOCKED" && !protectedTarget}
                        canUnlock={user.status === "LOCKED"}
                        canResendVerification={user.status === "PENDING"}
                      />
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
