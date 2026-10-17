import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ABUSE_REPORT_ERROR_CODES, AppError } from "@gieochu/core";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getAbuseReportDetail, type AbuseReportDetail } from "../../../../lib/abuse-report";
import { countOverdueRefundRequestsByTenant } from "../../../../lib/entitlement-remedy";
import { AdminPageHeader, GhostLinkButton, Notice } from "../../_ui/kit";
import { IconAlertTriangle, IconChevronLeft } from "../../_ui/icons";
import { ReportDetailView } from "../_ui/report-detail";

export const metadata: Metadata = { title: "Chi tiết báo cáo vi phạm" };

/**
 * ADR-038 mục 5 — chi tiết + xử lý 1 báo cáo. Cột chính: nội dung báo cáo → nội dung bị báo cáo (đánh giá chỉ sao +
 * nội dung + tên tài liệu, §7.9); cột phải (từ xl, dưới xl xếp sau): xử lý → gian hàng. Loader tự kiểm SYSTEM_ADMIN.
 */
export default async function AdminReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  await requireAdminAccess(`/admin/reports/${reportId}`);

  const back = (
    <GhostLinkButton href="/admin/reports">
      <IconChevronLeft className="h-4 w-4" /> Danh sách báo cáo
    </GhostLinkButton>
  );

  let detail: AbuseReportDetail;
  try {
    detail = await getAbuseReportDetail(reportId);
  } catch (error) {
    if (error instanceof AppError && error.code === ABUSE_REPORT_ERROR_CODES.NOT_FOUND) notFound();
    if (error instanceof AppError && error.code === ABUSE_REPORT_ERROR_CODES.UNAVAILABLE) {
      return (
        <div className="px-5 py-8 lg:px-8">
          <AdminPageHeader title="Báo cáo vi phạm" action={back} />
          <div className="mt-6">
            <Notice tone="warning" icon={<IconAlertTriangle className="h-5 w-5" />}>
              <p className="font-semibold">Báo cáo vi phạm chưa sẵn sàng</p>
              <p className="mt-0.5">Hệ thống chưa thể hiển thị báo cáo lúc này (cơ sở dữ liệu đang được cập nhật). Vui lòng thử lại sau.</p>
            </Notice>
          </div>
        </div>
      );
    }
    throw error;
  }

  // ADR-039 mục 3 + §7.9: chỉ SỐ ĐẾM yêu cầu hoàn tiền quá hạn của gian hàng (không id đơn/khách).
  const overdue = await countOverdueRefundRequestsByTenant({ tenantId: detail.tenant.id });
  const overdueRefunds = overdue.reduce((sum, row) => sum + row.count, 0);

  return <ReportDetailView detail={detail} back={back} overdueRefunds={overdueRefunds} />;
}
