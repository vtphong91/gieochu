import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getAdminTenantDetail } from "../../../../lib/admin-tenant-detail";
import { Badge, EmptyState, Notice } from "../../_ui/kit";
import { IconChevronLeft, IconClock, IconExternalLink, IconLock } from "../../_ui/icons";
import { formatAdminDate, formatAdminDateTime } from "../../_ui/billing-labels";
import { TENANT_STATUS_LABEL, TENANT_STATUS_TONE } from "../_ui/tenant-labels";
import { TenantLockButton } from "../_ui/tenant-lock-dialog";
import { TenantAuditLog } from "./_ui/audit-log";
import { SectionHeading } from "./_ui/parts";
import {
  AbuseSection,
  ContentSection,
  MetricsSection,
  OwnerSection,
  PaymentMethodsSection,
  PlanSection,
  TenantInfoSection,
} from "./_ui/sections";

export const metadata: Metadata = { title: "Chi tiết gian hàng" };

const LIST_PATH = "/admin/tenants";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

/**
 * ADR-072 — chi tiết một gian hàng (System Admin): thông tin, chủ gian hàng, gói dịch vụ, cổng thanh toán đang bật, số liệu kinh
 * doanh tổng hợp, nội dung & lưu trữ, vi phạm và nhật ký quản trị; khoá/mở khoá có lý do (hộp xác nhận). Chỉ dữ liệu L1 + số liệu
 * tổng hợp, không đọc đơn hàng/khách hàng của gian hàng (§7.9). Loader tự kiểm SYSTEM_ADMIN; id sai/không có gian hàng → 404.
 */
export default async function AdminTenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await requireAdminAccess(`${LIST_PATH}/${tenantId}`);
  const detail = await getAdminTenantDetail(tenantId);
  if (!detail) notFound();

  const locked = detail.status === "LOCKED";
  // Lý do khoá gần nhất = dòng TENANT_LOCKED mới nhất trong nhật ký (đã sắp mới nhất trước; chỉ có trong 50 dòng gần nhất).
  const lastLock = locked ? detail.audit.entries.find((entry) => entry.kind === "TENANT_LOCKED") : undefined;

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <nav aria-label="Đường dẫn trang">
        <Link
          href={LIST_PATH}
          className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold underline-offset-2 hover:underline lg:min-h-9 ${FOCUS}`}
          style={{ color: brandColors.primary }}
        >
          <IconChevronLeft className="h-4 w-4" />
          Gian hàng
        </Link>
      </nav>

      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
              {detail.name}
            </h1>
            <Badge tone={TENANT_STATUS_TONE[detail.status]}>{TENANT_STATUS_LABEL[detail.status]}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-gray-500">
            <span className="[overflow-wrap:anywhere]">/{detail.slug}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            Tạo ngày <time dateTime={detail.createdAt.toISOString()} className="tabular-nums">{formatAdminDate(detail.createdAt)}</time>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
          {/* Gian hàng bị khoá → storefront 404, ẩn nút để không dẫn tới trang lỗi. */}
          {locked ? null : (
            <Link
              href={`/${detail.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 motion-reduce:transition-none lg:min-h-0 ${FOCUS}`}
              style={{ borderColor: "#E5E7EB", color: brandColors.ink }}
            >
              <IconExternalLink className="h-4 w-4" />
              Mở trang gian hàng
              <span className="sr-only">(mở tab mới)</span>
            </Link>
          )}
          <TenantLockButton tenant={{ id: detail.id, name: detail.name, slug: detail.slug, status: detail.status }} />
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {locked ? (
          <Notice tone="warning" icon={<IconLock className="h-4 w-4" />}>
            <p className="font-semibold">Gian hàng đang bị khoá.</p>
            <p className="mt-1">Trang gian hàng và tài liệu không hiển thị công khai; khách không mua được.</p>
            <p className="mt-1 whitespace-pre-line [overflow-wrap:anywhere]">
              <span className="font-semibold">Lý do gần nhất: </span>
              {lastLock?.reason ?? "Không có lý do được ghi lại."}
            </p>
            {lastLock ? (
              <p className="mt-1 text-xs tabular-nums">
                Khoá lúc <time dateTime={lastLock.createdAt.toISOString()}>{formatAdminDateTime(lastLock.createdAt)}</time>
                {lastLock.source === "ABUSE_REPORT" ? " · từ báo cáo vi phạm" : ""}
              </p>
            ) : null}
          </Notice>
        ) : null}
        {detail.status === "READ_ONLY" ? (
          <Notice tone="info">
            <p className="font-semibold">Gian hàng đang tạm ngưng bán.</p>
            <p className="mt-1">Khách thấy trang tạm ngưng và không mua được; chủ gian hàng không tạo hay chỉnh sửa được nội dung.</p>
          </Notice>
        ) : null}

        <div className="grid items-start gap-8 xl:grid-cols-2">
          <TenantInfoSection detail={detail} />
          <OwnerSection owner={detail.owner} />
          <PlanSection subscription={detail.subscription} />
          <PaymentMethodsSection methods={detail.paymentMethods} />
        </div>

        <MetricsSection stats={detail.stats} />

        <div className="grid items-start gap-8 xl:grid-cols-2">
          <ContentSection content={detail.content} />
          <AbuseSection abuse={detail.abuse} />
        </div>

        <section aria-labelledby="tenant-audit-title">
          <SectionHeading
            id="tenant-audit-title"
            icon={<IconClock className="h-4 w-4" />}
            title="Nhật ký quản trị"
            description="Tạo gian hàng, khoá/mở khoá (kèm lý do), thanh toán/huỷ/mở lại hoá đơn gói và kiểm duyệt nội dung, mới nhất trước. Giờ Việt Nam."
          />
          {detail.audit.entries.length === 0 ? (
            <EmptyState icon={<IconClock className="h-6 w-6" />} title="Chưa có thao tác nào" description="Thao tác quản trị trên gian hàng sẽ hiện ở đây." />
          ) : (
            <TenantAuditLog entries={detail.audit.entries} total={detail.audit.total} />
          )}
        </section>
      </div>
    </div>
  );
}
