import type { Metadata } from "next";
import { requireAdminAccess } from "../../../lib/page-guards";
import { listAuditLogs, type AuditLogSearchParams } from "../../../lib/audit-query";
import { AdminPageHeader } from "../_ui/kit";
import { AuditFilterForm, AuditLogResults } from "../_ui/audit-log";

export const metadata: Metadata = { title: "Nhật ký hệ thống" };

const BASE_PATH = "/admin/audit";

/**
 * ADR-037 mục 7 — System Center → Nhật ký hệ thống. Bộ lọc là form GET (actor, action, tenant, from, to, pageSize),
 * phân trang bằng link giữ nguyên bộ lọc. Loader tự kiểm SYSTEM_ADMIN và che danh tính khách (§7.9).
 * Giao diện dùng chung với Studio → Hoạt động: `admin/_ui/audit-log.tsx`.
 */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<AuditLogSearchParams> }) {
  await requireAdminAccess("/admin/audit");
  const sp = await searchParams;
  const result = await listAuditLogs(sp);

  return (
    // Nằm trong app shell System Center (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Nhật ký hệ thống"
        subtitle="Các hành động quan trọng trên toàn hệ thống. Nhật ký chỉ ghi thêm, không sửa/xoá được và được giữ 12 tháng."
      />
      <AuditFilterForm basePath={BASE_PATH} filters={result.filters} scope="admin" />
      <AuditLogResults
        result={result}
        basePath={BASE_PATH}
        scope="admin"
        caption="Nhật ký hệ thống, mới nhất trước"
        emptyDescription="Các hành động như đăng nhập, khoá gian hàng, đổi cấu hình... sẽ xuất hiện ở đây."
      />
    </div>
  );
}
