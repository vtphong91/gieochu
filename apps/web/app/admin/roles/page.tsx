import Link from "next/link";
import { requireAdminAccess } from "../../../lib/page-guards";
import { getSystemRoleCounts, getTenantOwnerCount } from "../../../lib/admin-roles";
import { AdminPageHeader, Badge, Td, Tr, TableCard } from "../_ui/kit";
import { IconLayers, IconRoute, IconShield, IconUsers } from "../_ui/icons";

export default async function AdminRolesPage() {
  await requireAdminAccess("/admin/roles");

  const [system, tenantOwners] = await Promise.all([getSystemRoleCounts(), getTenantOwnerCount()]);

  return (
    <main className="space-y-8 px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Phân quyền hệ thống"
        subtitle={
          <>
            Trang tham khảo, chỉ đọc — không có nút chỉnh sửa nào ở đây. Muốn cấp/thu quyền, vào{" "}
            <Link href="/admin/users" className="font-medium text-[#0F3B82] underline">
              Người dùng
            </Link>
            .
          </>
        }
      />

      <TableCard
        icon={<IconLayers className="h-5 w-5" />}
        title="1. Ba lớp tài khoản"
        description="Không phải 3 cấp role chồng nhau — là 3 vai trò độc lập mà cùng một user có thể đồng thời mang."
        head={["Lớp", "Bảng dữ liệu", "Route", "Ý nghĩa"]}
      >
        {[
          ["System", "users.systemRole", "/admin/*", "Quản trị toàn nền tảng"],
          ["Tenant", "tenant_members.role", "/studio/[slug]/*", "Chủ shop / nhân sự trong 1 tenant"],
          ["Customer", "tenant_customers (không có cột role)", "/account/*", "Người đã mua hàng ở 1+ tenant"],
        ].map((row) => (
          <Tr key={row[0]}>
            {row.map((cell, i) => (
              <Td key={i} className={i === 0 ? "font-medium" : i === 1 ? "font-mono text-xs text-gray-500" : undefined}>
                {cell}
              </Td>
            ))}
          </Tr>
        ))}
      </TableCard>

      <TableCard
        icon={<IconShield className="h-5 w-5" />}
        title="2. Vai trò System"
        description="Số liệu thật, đọc trực tiếp từ bảng users (L1) — an toàn hiển thị cho System Admin."
        head={["Vai trò", "Mô tả", "Số lượng hiện tại"]}
      >
        <Tr>
          <Td className="font-mono text-xs font-medium">USER</Td>
          <Td>Tài khoản thường — không vào được /admin/*</Td>
          <Td>
            <Badge tone="neutral">{system.user}</Badge>
          </Td>
        </Tr>
        <Tr>
          <Td className="font-mono text-xs font-medium">SYSTEM_ADMIN</Td>
          <Td>Vào được toàn bộ System Center (MVP chưa chia nhỏ theo module)</Td>
          <Td>
            <Badge tone="info">{system.systemAdmin}</Badge>
          </Td>
        </Tr>
        <Tr>
          <Td className="font-mono text-xs font-medium">isSuperAdmin = true</Td>
          <Td>Root — không ai khoá được (kể cả admin khác); chỉ super admin mới cấp được quyền SYSTEM_ADMIN cho người khác</Td>
          <Td>
            <Badge tone="success">{system.superAdmin}</Badge>
          </Td>
        </Tr>
      </TableCard>

      <TableCard
        icon={<IconUsers className="h-5 w-5" />}
        title="3. Vai trò Tenant (Studio)"
        description="Tenant.ownerId là unique nên số tenant = số OWNER. STAFF đã có sẵn trong schema nhưng MVP chưa có luồng mời/tạo — luôn bằng 0."
        head={["Vai trò", "Mô tả", "Số lượng hiện tại"]}
      >
        <Tr>
          <Td className="font-mono text-xs font-medium">OWNER</Td>
          <Td>Chủ shop — toàn quyền trong tenant của mình</Td>
          <Td>
            <Badge tone="info">{tenantOwners}</Badge>
          </Td>
        </Tr>
        <Tr>
          <Td className="font-mono text-xs font-medium">STAFF</Td>
          <Td>Nhân sự phụ — chưa có luồng tạo trong sản phẩm (dự phòng schema)</Td>
          <Td>
            <Badge tone="neutral">0</Badge>
          </Td>
        </Tr>
      </TableCard>

      <section className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
        <h2 className="font-[family-name:var(--font-heading)] font-semibold">4. Customer</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
          Không phải role — chỉ cần có bản ghi <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">tenant_customers</code> (tự tạo khi đơn
          hàng đầu tiên &quot;PAID&quot;). System Admin không có route nào đọc bảng này hay đơn hàng của tenant (§7.9), nên trang này không hiển
          thị số liệu customer.
        </p>
      </section>

      <TableCard
        icon={<IconRoute className="h-5 w-5" />}
        title="5. Ma trận route → guard"
        description="Áp dụng ở mọi Server Component/Server Action/API Route Handler — proxy.ts không kiểm tra quyền, chỉ gắn header."
        head={["Route", "Guard function", "Sai quyền thì sao"]}
      >
        {[
          ["/admin/*", "requireAdminAccess() — lib/page-guards.ts", "Chưa đăng nhập → /login; sai role → 404"],
          ["/studio/[slug]/*", "requireTenantMember(slug, OWNER) — lib/tenant.ts", "Không phải thành viên/sai role → 403 hoặc 404"],
          ["/account/*", "requireVerifiedAccess() — lib/page-guards.ts", "Chưa đăng nhập/chưa xác minh → redirect tương ứng"],
          ["API/Server Action (mọi module)", 'requireRole("SYSTEM_ADMIN") — lib/session.ts', "Ném AppError 403"],
        ].map((row) => (
          <Tr key={row[0]}>
            <Td className="font-mono text-xs font-medium">{row[0]}</Td>
            <Td className="font-mono text-xs text-gray-500">{row[1]}</Td>
            <Td>{row[2]}</Td>
          </Tr>
        ))}
      </TableCard>

      <section className="rounded-2xl border p-5 text-sm" style={{ borderColor: "#BFDBFE", background: "#EFF6FF", color: "#1E3A8A" }}>
        <p className="font-semibold">Vì sao không che URL /admin?</p>
        <p className="mt-1.5">
          Vì bảo mật thật nằm ở việc guard kiểm tra quyền cho <em>mọi</em> request ở server (không tin proxy.ts, không tin URL) — đổi URL thành
          chuỗi bí mật chỉ tạo cảm giác an toàn giả (security through obscurity), không thay thế được việc kiểm tra quyền. Ai không đúng role dù
          biết URL chính xác cũng chỉ nhận 404, không lấy được dữ liệu gì.
        </p>
      </section>
    </main>
  );
}
