import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { grantSystemAdminAction, lockUserAction, resendVerificationAdminAction, unlockUserAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ kích hoạt",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khoá",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminAccess("/admin/users");
  const { q } = await searchParams;

  const prisma = getPrismaClient();
  const users = await prisma.user.findMany({
    where: q ? { email: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { profile: true },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Người dùng</h1>

      <form className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Tìm theo email..."
          className="w-full max-w-sm rounded border px-3 py-2"
        />
      </form>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2">Email</th>
            <th className="py-2">Họ tên</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2">Vai trò</th>
            <th className="py-2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b">
              <td className="py-2">{user.email}</td>
              <td className="py-2">{user.profile?.fullName ?? "—"}</td>
              <td className="py-2">{STATUS_LABEL[user.status] ?? user.status}</td>
              <td className="py-2">{user.isSuperAdmin ? "Super admin" : user.systemRole}</td>
              <td className="py-2">
                <div className="flex flex-wrap gap-2">
                  {user.status === "LOCKED" ? (
                    <form action={unlockUserAction.bind(null, user.id)}>
                      <button type="submit" className="text-[var(--color-primary)]">
                        Mở khoá
                      </button>
                    </form>
                  ) : (
                    <form action={lockUserAction.bind(null, user.id)}>
                      <button type="submit" className="text-red-600">
                        Khoá
                      </button>
                    </form>
                  )}
                  {user.status === "PENDING" ? (
                    <form action={resendVerificationAdminAction.bind(null, user.id)}>
                      <button type="submit" className="text-[var(--color-primary)]">
                        Gửi lại email kích hoạt
                      </button>
                    </form>
                  ) : null}
                  {user.systemRole !== "SYSTEM_ADMIN" ? (
                    <form action={grantSystemAdminAction.bind(null, user.id)}>
                      <button type="submit" className="text-[var(--color-primary)]">
                        Cấp quyền admin
                      </button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
