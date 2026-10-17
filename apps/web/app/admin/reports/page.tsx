import type { Metadata } from "next";
import { requireAdminAccess } from "../../../lib/page-guards";
import { listAbuseReports, type AbuseReportSearchParams } from "../../../lib/abuse-report";
import { AdminPageHeader, Badge } from "../_ui/kit";
import { parsePagination } from "../_ui/pagination-utils";
import { ReportFilterForm, ReportResults } from "./_ui/report-list";

export const metadata: Metadata = { title: "Báo cáo vi phạm" };

const BASE_PATH = "/admin/reports";
const numberFormat = new Intl.NumberFormat("vi-VN");

/**
 * ADR-038 mục 5 — System Center → Giám sát → Báo cáo vi phạm. Lọc bằng form GET (`status` mặc định OPEN, `ALL` = mọi
 * trạng thái; `type`; `targetType`; `pageSize`), phân trang bằng link giữ bộ lọc. Loader tự kiểm SYSTEM_ADMIN.
 * Giao diện: `./_ui/report-list.tsx` (mẫu trang nhật ký M12a).
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<AbuseReportSearchParams & { page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess(BASE_PATH);
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);
  const result = await listAbuseReports(sp, { skip, take });

  return (
    // Nằm trong app shell System Center (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Báo cáo vi phạm"
        subtitle="Báo cáo của người dùng về tài liệu, đánh giá và bài viết. Email người báo cáo chỉ quản trị viên thấy — không bao giờ gửi cho gian hàng."
        action={
          result.status === "ok" ? (
            <Badge tone={result.openCount > 0 ? "warning" : "success"}>
              {result.openCount > 0 ? `${numberFormat.format(result.openCount)} báo cáo chờ xử lý` : "Không có báo cáo chờ xử lý"}
            </Badge>
          ) : undefined
        }
      />
      <ReportFilterForm basePath={BASE_PATH} filters={result.filters} pageSize={pageSize} />
      <ReportResults result={result} basePath={BASE_PATH} page={page} pageSize={pageSize} />
    </div>
  );
}
