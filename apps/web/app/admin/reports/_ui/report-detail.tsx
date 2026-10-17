import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import {
  ABUSE_REPORT_DECISION_LABELS,
  ABUSE_REPORT_STATUS_LABELS,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_TARGET_TYPE_LABELS,
} from "@gieochu/core/abuse-report";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { REMEDY_REFUND_SLA_DAYS } from "@gieochu/core/entitlement-remedy";
import type { AbuseReportDetail, AbuseReportTargetView } from "../../../../lib/abuse-report";
import { AdminPageHeader, Badge, ConfigCard, MainAsideGrid, Notice } from "../../_ui/kit";
import { IconAlertTriangle, IconExternalLink, IconFlag, IconLock, IconShield, IconStore } from "../../_ui/icons";
import { ModerationLockBadge } from "../../_ui/moderation-lock";
import { ReviewStars } from "../../../[tenantSlug]/_ui/review-parts";
import { ResolveReportForm, UnlockModerationButton } from "./report-actions";
import { REPORT_STATUS_TONE, TENANT_STATUS_LABEL, TENANT_STATUS_TONE } from "./report-list";

/*
 * ADR-038 mục 5 — thân trang chi tiết 1 báo cáo (Server Component). Cột chính: nội dung báo cáo → nội dung bị báo cáo
 * (đánh giá chỉ sao + nội dung + tên tài liệu, §7.9); cột phải (từ xl; dưới xl xếp sau): xử lý → gian hàng (kèm số
 * yêu cầu hoàn tiền quá hạn — ADR-039, chỉ số đếm). Trang `[reportId]/page.tsx` lo tải dữ liệu + trạng thái lỗi.
 */

const INK = brandColors.ink;
const INK_SOFT = "#6B7280"; // 4.8:1 trên nền trắng
const LINE = "#E5E7EB";
const WRAP_ANY = "min-w-0 [overflow-wrap:anywhere]";
const LINK = "inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)] lg:min-h-8";

const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** Nhãn trạng thái hiện tại của đối tượng (thay enum thô). */
const TARGET_STATUS: Record<AbuseReportTargetView["kind"], Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }>> = {
  PRODUCT: {
    DRAFT: { label: "Riêng tư", tone: "warning" },
    PUBLISHED: { label: "Công khai", tone: "success" },
    ARCHIVED: { label: "Đã lưu trữ", tone: "neutral" },
  },
  REVIEW: {
    VISIBLE: { label: "Đang hiển thị", tone: "success" },
    HIDDEN: { label: "Đã ẩn", tone: "warning" },
  },
  POST: {
    DRAFT: { label: "Bản nháp", tone: "warning" },
    PUBLISHED: { label: "Đã đăng", tone: "success" },
    HIDDEN: { label: "Bị ẩn", tone: "danger" },
  },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium" style={{ color: INK_SOFT }}>
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm ${WRAP_ANY}`} style={{ color: INK }}>
        {children}
      </dd>
    </div>
  );
}

function ReportContent({ detail }: { detail: AbuseReportDetail }) {
  return (
    <ConfigCard icon={<IconFlag className="h-5 w-5" />} title="Nội dung báo cáo" badges={<Badge tone="info">{ABUSE_REPORT_TYPE_LABELS[detail.type]}</Badge>}>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời gian gửi">
          <time dateTime={detail.createdAt.toISOString()}>{dateTimeFormat.format(detail.createdAt)}</time>
        </Field>
        <Field label="Người báo cáo (chỉ quản trị viên thấy)">
          {detail.reporterEmail}
          <span className="block text-xs" style={{ color: INK_SOFT }}>
            {detail.reporterUserId ? "Thành viên đã đăng nhập" : "Khách (chưa đăng nhập)"}
            {detail.ip ? ` · IP ${detail.ip}` : ""}
          </span>
        </Field>
      </dl>

      <div>
        <h3 className="text-xs font-medium" style={{ color: INK_SOFT }}>
          Mô tả
        </h3>
        <p className={`mt-1 rounded-xl border bg-gray-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${WRAP_ANY}`} style={{ borderColor: LINE, color: INK }}>
          {detail.description}
        </p>
      </div>

      <div>
        <h3 className="text-xs font-medium" style={{ color: INK_SOFT }}>
          Link bằng chứng
        </h3>
        {detail.evidenceUrls.length > 0 ? (
          <ul className="mt-1 space-y-1">
            {detail.evidenceUrls.map((url) => (
              <li key={url} className="min-w-0">
                {/* Link do người dùng gửi: mở tab mới, không chuyển referrer/opener, không truyền uy tín SEO. */}
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={`${LINK} items-start py-2 lg:py-1 ${WRAP_ANY}`} style={{ color: brandColors.primary }}>
                  <IconExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className={WRAP_ANY}>{url}</span>
                  <span className="sr-only"> (liên kết ngoài, mở tab mới)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
            Không có.
          </p>
        )}
      </div>
    </ConfigCard>
  );
}

function TargetContent({ detail }: { detail: AbuseReportDetail }) {
  const target = detail.target;
  const title = `${ABUSE_TARGET_TYPE_LABELS[detail.targetType]} bị báo cáo`;
  if (!target) {
    return (
      <ConfigCard icon={<IconAlertTriangle className="h-5 w-5" />} title={title}>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Nội dung đã bị gian hàng xoá. Bạn vẫn có thể bác bỏ báo cáo hoặc khoá gian hàng nếu cần.
        </p>
      </ConfigCard>
    );
  }
  const status = TARGET_STATUS[target.kind][target.status] ?? { label: target.status, tone: "neutral" as const };

  return (
    <ConfigCard
      icon={<IconShield className="h-5 w-5" />}
      title={title}
      badges={
        <>
          <Badge tone={status.tone}>{status.label}</Badge>
          {target.moderationLockedAt ? <ModerationLockBadge /> : null}
        </>
      }
    >
      {target.kind === "PRODUCT" ? (
        <div className="space-y-1">
          <p className={`font-[family-name:var(--font-heading)] text-base font-semibold ${WRAP_ANY}`} style={{ color: INK }}>
            {target.title}
          </p>
          {target.summary ? (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
              {target.summary}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: INK_SOFT }}>
              Tài liệu chưa có mô tả ngắn.
            </p>
          )}
        </div>
      ) : null}

      {target.kind === "REVIEW" ? (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK }}>
            <ReviewStars rating={target.rating} label={`${target.rating} trên 5 sao`} className="text-[color:var(--color-accent)]" />
            <span className="font-medium">{target.rating}/5</span>
            <span style={{ color: INK_SOFT }}>· cho tài liệu</span>
            <span className={`font-semibold ${WRAP_ANY}`}>{target.productTitle}</span>
          </p>
          {target.body ? (
            <p className={`rounded-xl border bg-gray-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${WRAP_ANY}`} style={{ borderColor: LINE, color: INK }}>
              {target.body}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: INK_SOFT }}>
              Khách chỉ chấm sao, không viết nhận xét.
            </p>
          )}
          <p className="text-xs" style={{ color: INK_SOFT }}>
            Danh tính khách viết đánh giá không hiển thị ở System Center (đặc tả §7.9).
          </p>
        </div>
      ) : null}

      {target.kind === "POST" ? (
        <div className="space-y-2">
          {target.title ? (
            <p className={`font-[family-name:var(--font-heading)] text-base font-semibold ${WRAP_ANY}`} style={{ color: INK }}>
              {target.title}
            </p>
          ) : null}
          {target.bodyText ? (
            // Vùng cuộn riêng phải nhận được focus bàn phím (WCAG 2.1.1) — tabIndex + tên vùng.
            <div
              tabIndex={0}
              role="region"
              aria-label="Nội dung bài viết (văn bản thuần)"
              className={`max-h-80 overflow-y-auto rounded-xl border bg-gray-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B82]/40 ${WRAP_ANY}`}
              style={{ borderColor: LINE, color: INK }}
            >
              {target.bodyText}
            </div>
          ) : (
            <p className="text-sm italic" style={{ color: INK_SOFT }}>
              Bài chỉ có ảnh.
            </p>
          )}
        </div>
      ) : null}

      {target.publicPath ? (
        <a href={target.publicPath} target="_blank" rel="noopener noreferrer" className={LINK} style={{ color: brandColors.primary }}>
          Xem trang công khai <IconExternalLink className="h-4 w-4" />
          <span className="sr-only">(mở tab mới)</span>
        </a>
      ) : (
        <p className="text-xs" style={{ color: INK_SOFT }}>
          Nội dung hiện không hiển thị công khai.
        </p>
      )}

      {target.moderationLockedAt ? (
        <div className="space-y-3 border-t pt-4" style={{ borderColor: LINE }}>
          <Notice tone="warning" icon={<IconLock className="h-4 w-4" />}>
            <p className="font-semibold">Đang khoá kiểm duyệt</p>
            <p className="mt-0.5">
              Từ {dateTimeFormat.format(target.moderationLockedAt)}
              {target.moderationReason ? ` — lý do: ${target.moderationReason}` : ""}. Gian hàng không tự xuất bản lại / bỏ ẩn được cho tới khi gỡ
              khoá.
            </p>
          </Notice>
          <UnlockModerationButton targetType={detail.targetType} targetId={detail.targetId} />
        </div>
      ) : null}
    </ConfigCard>
  );
}

function ResolutionCard({ detail }: { detail: AbuseReportDetail }) {
  if (detail.status === "OPEN") {
    return (
      <ConfigCard icon={<IconShield className="h-5 w-5" />} title="Xử lý báo cáo" badges={<Badge tone="warning">{ABUSE_REPORT_STATUS_LABELS.OPEN}</Badge>}>
        {detail.otherOpenReports > 0 ? (
          <Notice tone="info">
            Còn <strong className="font-semibold">{detail.otherOpenReports}</strong> báo cáo khác đang chờ về cùng nội dung này.
          </Notice>
        ) : null}
        <ResolveReportForm
          reportId={detail.id}
          targetType={detail.targetType}
          tenantName={detail.tenant.name}
          allowedDecisions={detail.allowedDecisions}
          otherOpenReports={detail.otherOpenReports}
        />
      </ConfigCard>
    );
  }
  return (
    <ConfigCard
      icon={<IconShield className="h-5 w-5" />}
      title="Kết quả xử lý"
      badges={<Badge tone={REPORT_STATUS_TONE[detail.status]}>{ABUSE_REPORT_STATUS_LABELS[detail.status]}</Badge>}
    >
      <dl className="grid gap-4">
        <Field label="Quyết định">{detail.decision ? ABUSE_REPORT_DECISION_LABELS[detail.decision] : "—"}</Field>
        <Field label="Thời gian xử lý">
          {detail.resolvedAt ? <time dateTime={detail.resolvedAt.toISOString()}>{dateTimeFormat.format(detail.resolvedAt)}</time> : "—"}
        </Field>
        <Field label="Người xử lý">{detail.resolvedByEmail ?? "—"}</Field>
        <Field label="Ghi chú nội bộ">
          {detail.resolutionNote ? <span className="whitespace-pre-wrap">{detail.resolutionNote}</span> : <span style={{ color: INK_SOFT }}>Không có.</span>}
        </Field>
      </dl>
    </ConfigCard>
  );
}

function TenantCard({ detail, overdueRefunds }: { detail: AbuseReportDetail; overdueRefunds: number }) {
  const { tenant } = detail;
  return (
    <ConfigCard
      icon={<IconStore className="h-5 w-5" />}
      title="Gian hàng"
      badges={<Badge tone={TENANT_STATUS_TONE[tenant.status] ?? "neutral"}>{TENANT_STATUS_LABEL[tenant.status] ?? tenant.status}</Badge>}
    >
      <dl className="grid gap-3">
        <Field label="Tên">{tenant.name}</Field>
        <Field label="Đường dẫn">/{tenant.slug}</Field>
        <Field label={`Yêu cầu hoàn tiền quá ${REMEDY_REFUND_SLA_DAYS} ngày`}>
          {overdueRefunds > 0 ? (
            <span className="flex flex-col items-start gap-1">
              <Badge tone="danger">{overdueRefunds} yêu cầu quá hạn</Badge>
              <span style={{ color: INK_SOFT }}>Gian hàng chưa hoàn tiền cho khách đúng hạn. Có thể khoá gian hàng ở trang quản lý tenant.</span>
            </span>
          ) : (
            <span style={{ color: INK_SOFT }}>Không có</span>
          )}
        </Field>
      </dl>
      <div className="flex flex-wrap gap-x-4">
        {tenant.status !== "LOCKED" ? (
          <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className={LINK} style={{ color: brandColors.primary }}>
            Xem gian hàng <IconExternalLink className="h-4 w-4" />
            <span className="sr-only">(mở tab mới)</span>
          </a>
        ) : null}
        <Link href="/admin/tenants" className={LINK} style={{ color: brandColors.primary }}>
          Quản lý tenant
        </Link>
      </div>
    </ConfigCard>
  );
}

/** Tiêu đề + lưới 2 cột của trang chi tiết. `back`: nút quay lại danh sách. */
export function ReportDetailView({ detail, back, overdueRefunds = 0 }: { detail: AbuseReportDetail; back: ReactNode; overdueRefunds?: number }) {
  return (
    // Nằm trong app shell System Center (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={`Báo cáo: ${ABUSE_REPORT_TYPE_LABELS[detail.type]}`}
        subtitle={`${ABUSE_TARGET_TYPE_LABELS[detail.targetType]} của gian hàng ${detail.tenant.name} (/${detail.tenant.slug}) · gửi lúc ${dateTimeFormat.format(detail.createdAt)}`}
        action={back}
      />
      <MainAsideGrid
        asideLabel="Xử lý báo cáo và thông tin gian hàng"
        main={
          <>
            <ReportContent detail={detail} />
            <TargetContent detail={detail} />
          </>
        }
        aside={
          <>
            <ResolutionCard detail={detail} />
            <TenantCard detail={detail} overdueRefunds={overdueRefunds} />
          </>
        }
      />
    </div>
  );
}
