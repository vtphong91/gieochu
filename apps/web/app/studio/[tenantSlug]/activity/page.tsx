import type { Metadata } from "next";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listTenantAuditLogs, type AuditLogSearchParams } from "../../../../lib/audit-query";
import { AdminPageHeader } from "../../../admin/_ui/kit";
import { AuditFilterForm, AuditLogResults } from "../../../admin/_ui/audit-log";

export const metadata: Metadata = { title: "Hoạt động" };

/**
 * ADR-037 mục 7 — Studio → Hoạt động: nhật ký của riêng tenant (chỉ dòng có tenantId của tenant này; loader tự kiểm
 * OWNER, che actor ngoài tenant). Bộ lọc GET: action, from, to, pageSize. Giao diện dùng chung `admin/_ui/audit-log.tsx`.
 */
export default async function StudioActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<AuditLogSearchParams>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/activity`);
  const sp = await searchParams;
  const result = await listTenantAuditLogs(tenant.id, sp);
  const basePath = `/studio/${tenant.slug}/activity`;

  return (
    // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Hoạt động" subtitle="Các thao tác quan trọng trên gian hàng của bạn, giữ trong 12 tháng." />
      <AuditFilterForm basePath={basePath} filters={result.filters} scope="studio" />
      <AuditLogResults
        result={result}
        basePath={basePath}
        scope="studio"
        caption="Hoạt động của gian hàng, mới nhất trước"
        emptyDescription="Các thao tác như xuất bản tài liệu, xác nhận đơn, tạo link chia sẻ... sẽ xuất hiện ở đây."
      />
    </div>
  );
}
