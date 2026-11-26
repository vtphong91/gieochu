import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import {
  ABUSE_REPORT_STATUS_LABELS,
  ABUSE_REPORT_STATUSES,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_TARGET_TYPE_LABELS,
} from "@gieochu/core/abuse-report";
import type { AdminTenantDetail } from "../../../../../lib/admin-tenant-detail";
import { Badge } from "../../../_ui/kit";
import { IconCard, IconDatabase, IconFlag, IconGrid, IconPackage, IconStore, IconUsers } from "../../../_ui/icons";
import { formatVndFull } from "../../../_ui/stats-chart";
import {
  INVOICE_PROVIDER_LABEL,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  formatAdminDate,
  formatAdminDateTime,
} from "../../../_ui/billing-labels";
import {
  OWNER_STATUS_LABEL,
  OWNER_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  TENANT_STATUS_LABEL,
  TENANT_STATUS_TONE,
  formatStorage,
  formatStorageFromMb,
  formatVnDateString,
} from "../../_ui/tenant-labels";
import { CARD, CompactEmpty, Dash, InfoGrid, LINE, SectionHeading, StatTile, TextLink, UsageBar, type InfoItem } from "./parts";

/*
 * ADR-072 — các phần của trang chi tiết gian hàng. Server Component thuần. §7.9: không có đơn hàng/khách/giao dịch của gian hàng —
 * chỉ dữ liệu L1, số liệu tổng hợp `tenant_daily_stats`, số đếm tài liệu và tên cổng thanh toán đang bật.
 */

const numberFormat = new Intl.NumberFormat("vi-VN");
const ICON = "h-4 w-4";

// ───────────────────────── Thông tin gian hàng ─────────────────────────

export function TenantInfoSection({ detail }: { detail: AdminTenantDetail }) {
  const items: InfoItem[] = [
    { label: "Tên gian hàng", value: <span className="font-semibold">{detail.name}</span> },
    { label: "Đường dẫn", value: <span>/{detail.slug}</span> },
    { label: "Trạng thái", value: <Badge tone={TENANT_STATUS_TONE[detail.status]}>{TENANT_STATUS_LABEL[detail.status]}</Badge> },
    { label: "Ngày tạo", value: <span className="tabular-nums">{formatAdminDate(detail.createdAt)}</span> },
    {
      label: "Tiền tố mã đơn",
      value: detail.orderCodePrefix ? <span className="font-mono">{detail.orderCodePrefix}</span> : <Dash srText="Chưa đặt" />,
    },
  ];
  if (detail.previousSlugs.length > 0) {
    items.push({
      label: "Đường dẫn cũ",
      wide: true,
      value: (
        <ul className="space-y-0.5">
          {detail.previousSlugs.map((previous) => (
            <li key={`${previous.slug}-${previous.changedAt.toISOString()}`}>
              /{previous.slug} <span className="text-xs text-gray-600 tabular-nums">(đổi ngày {formatAdminDate(previous.changedAt)})</span>
            </li>
          ))}
        </ul>
      ),
    });
  }
  return (
    <section aria-labelledby="tenant-info-title">
      <SectionHeading id="tenant-info-title" icon={<IconStore className={ICON} />} title="Thông tin gian hàng" />
      <div className={CARD} style={{ borderColor: LINE }}>
        <InfoGrid items={items} />
      </div>
    </section>
  );
}

// ───────────────────────── Chủ gian hàng ─────────────────────────

export function OwnerSection({ owner }: { owner: AdminTenantDetail["owner"] }) {
  const items: InfoItem[] = [
    {
      label: "Họ tên",
      // ADR-073: sang trang chi tiết người dùng (chủ gian hàng) — vùng bấm 44px dưới lg như `TextLink`.
      value: (
        <Link
          href={`/admin/users/${owner.id}`}
          className="inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] lg:min-h-9"
          style={{ color: brandColors.primary }}
        >
          {owner.fullName ?? owner.email}
          <span className="sr-only"> (xem chi tiết người dùng)</span>
        </Link>
      ),
    },
    { label: "Email", value: <span>{owner.email}</span> },
    { label: "Trạng thái tài khoản", value: <Badge tone={OWNER_STATUS_TONE[owner.status]}>{OWNER_STATUS_LABEL[owner.status]}</Badge> },
    { label: "Ngày tạo tài khoản", value: <span className="tabular-nums">{formatAdminDate(owner.joinedAt)}</span> },
  ];
  return (
    <section aria-labelledby="tenant-owner-title">
      <SectionHeading id="tenant-owner-title" icon={<IconUsers className={ICON} />} title="Chủ gian hàng" />
      <div className={CARD} style={{ borderColor: LINE }}>
        <InfoGrid items={items} />
      </div>
    </section>
  );
}

// ───────────────────────── Gói dịch vụ ─────────────────────────

export function PlanSection({ subscription }: { subscription: AdminTenantDetail["subscription"] }) {
  return (
    <section aria-labelledby="tenant-plan-title">
      <SectionHeading id="tenant-plan-title" icon={<IconPackage className={ICON} />} title="Gói dịch vụ" />
      <div className={CARD} style={{ borderColor: LINE }}>
        {subscription === null ? (
          <CompactEmpty>Gian hàng chưa có thuê bao gói dịch vụ.</CompactEmpty>
        ) : (
          <PlanBody subscription={subscription} />
        )}
      </div>
    </section>
  );
}

function PlanBody({ subscription }: { subscription: NonNullable<AdminTenantDetail["subscription"]> }) {
  const { plan, latestInvoice } = subscription;
  const statusLabels: Record<string, string> = SUBSCRIPTION_STATUS_LABEL;
  const statusTones: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = SUBSCRIPTION_STATUS_TONE;
  const invoiceLabels: Record<string, string> = INVOICE_STATUS_LABEL;
  const invoiceTones: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = INVOICE_STATUS_TONE;
  const providerLabels: Record<string, string> = INVOICE_PROVIDER_LABEL;

  const items: InfoItem[] = [
    {
      label: "Gói",
      value: (
        <>
          <span className="block font-semibold">{plan.name}</span>
          <span className="block text-xs text-gray-600 tabular-nums">{plan.isFree ? "Miễn phí" : `Giá gói ${formatVndFull(plan.priceVnd)}`}</span>
        </>
      ),
    },
    {
      label: "Trạng thái thuê bao",
      value: <Badge tone={statusTones[subscription.status] ?? "neutral"}>{statusLabels[subscription.status] ?? subscription.status}</Badge>,
    },
    { label: "Bắt đầu kỳ", value: <span className="tabular-nums">{formatAdminDate(subscription.currentPeriodStart)}</span> },
    {
      label: "Hết hạn",
      value: plan.isFree ? "Không thời hạn" : <span className="tabular-nums">{formatAdminDate(subscription.currentPeriodEnd)}</span>,
    },
    {
      label: "Hạn ân hạn",
      value: subscription.graceEndsAt ? (
        <span className="tabular-nums">{formatAdminDate(subscription.graceEndsAt)}</span>
      ) : (
        <span className="text-gray-600">
          <Dash srText="Không có" />
        </span>
      ),
    },
    {
      label: "Hoá đơn gần nhất",
      wide: true,
      value: latestInvoice ? (
        <>
          <span className="font-mono text-xs font-semibold">{latestInvoice.code}</span>{" "}
          <Badge tone={invoiceTones[latestInvoice.status] ?? "neutral"}>{invoiceLabels[latestInvoice.status] ?? latestInvoice.status}</Badge>
          <span className="mt-1 block text-xs text-gray-600 tabular-nums">
            {formatVndFull(latestInvoice.amountVnd)} · {providerLabels[latestInvoice.provider] ?? latestInvoice.provider} · tạo{" "}
            {formatAdminDateTime(latestInvoice.createdAt)}
          </span>
        </>
      ) : (
        <span className="text-gray-600">
          <Dash srText="Chưa có hoá đơn" />
        </span>
      ),
    },
  ];

  return (
    <>
      <InfoGrid items={items} />
      <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
        <TextLink href={`/admin/subscriptions/${subscription.id}`}>Xem chi tiết đơn hàng gói dịch vụ</TextLink>
      </div>
    </>
  );
}

// ───────────────────────── Phương thức thanh toán đang bật ─────────────────────────

export function PaymentMethodsSection({ methods }: { methods: AdminTenantDetail["paymentMethods"] }) {
  return (
    <section aria-labelledby="tenant-payments-title">
      <SectionHeading
        id="tenant-payments-title"
        icon={<IconCard className={ICON} />}
        title="Phương thức thanh toán đang bật"
        description="Chỉ hiện tên cổng — không có số tài khoản hay khoá bí mật của gian hàng."
      />
      <div className={CARD} style={{ borderColor: LINE }}>
        {methods.length === 0 ? (
          <CompactEmpty>Gian hàng chưa bật phương thức thanh toán nào.</CompactEmpty>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {methods.map((method) => (
              <li key={method}>
                <Badge tone="info">{PAYMENT_METHOD_LABEL[method]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ───────────────────────── Số liệu kinh doanh ─────────────────────────

function MetricsCard({ title, caption, metrics }: { title: string; caption: string; metrics: AdminTenantDetail["stats"]["last30d"] }) {
  return (
    <div className={CARD} style={{ borderColor: LINE }}>
      <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold" style={{ color: brandColors.ink }}>
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-gray-600 tabular-nums">{caption}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
        <StatTile label="GMV" value={formatVndFull(metrics.gmvVnd)} />
        <StatTile label="Đơn đã thanh toán" value={numberFormat.format(metrics.ordersPaid)} />
        <StatTile label="Khách mới" value={numberFormat.format(metrics.newCustomers)} />
        <StatTile label="Lượt tải" value={numberFormat.format(metrics.downloads)} />
      </dl>
    </div>
  );
}

export function MetricsSection({ stats }: { stats: AdminTenantDetail["stats"] }) {
  const { last30d, allTime, window, asOf } = stats;
  const hasAnyData = allTime.gmvVnd > 0 || allTime.ordersPaid > 0 || allTime.newCustomers > 0 || allTime.downloads > 0;
  return (
    <section aria-labelledby="tenant-metrics-title">
      <SectionHeading
        id="tenant-metrics-title"
        icon={<IconGrid className={ICON} />}
        title="Số liệu kinh doanh"
        description="Số liệu tổng hợp đến hết hôm qua, cập nhật hằng ngày. Không có chi tiết đơn hàng hay khách hàng."
      />
      {hasAnyData ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <MetricsCard
              title="30 ngày gần nhất"
              caption={`${formatVnDateString(window.from)} – ${formatVnDateString(window.to)}`}
              metrics={last30d}
            />
            <MetricsCard title="Từ trước tới nay" caption={`Đến hết ${formatVnDateString(window.to)}`} metrics={allTime} />
          </div>
          {asOf ? (
            <p className="mt-3 text-xs text-gray-600">
              Lần tổng hợp gần nhất của hệ thống: <time dateTime={asOf.toISOString()} className="tabular-nums">{formatAdminDateTime(asOf)}</time>.
            </p>
          ) : null}
        </>
      ) : (
        <div className={CARD} style={{ borderColor: LINE }}>
          <CompactEmpty>Chưa có số liệu kinh doanh — gian hàng chưa phát sinh đơn hàng hoặc số liệu chưa được tổng hợp.</CompactEmpty>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Nội dung & lưu trữ ─────────────────────────

export function ContentSection({ content }: { content: AdminTenantDetail["content"] }) {
  const { products, storageUsedBytes, storageLimitMb, maxProducts } = content;
  return (
    <section aria-labelledby="tenant-content-title">
      <SectionHeading id="tenant-content-title" icon={<IconDatabase className={ICON} />} title="Nội dung & lưu trữ" />
      <div className={`${CARD} space-y-5`} style={{ borderColor: LINE }}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Tổng tài liệu" value={numberFormat.format(products.total)} />
          <StatTile label="Đã xuất bản" value={numberFormat.format(products.PUBLISHED)} />
          <StatTile label="Bản nháp" value={numberFormat.format(products.DRAFT)} />
          <StatTile label="Lưu trữ" value={numberFormat.format(products.ARCHIVED)} />
        </dl>

        {storageLimitMb !== null ? (
          <UsageBar
            id="tenant-storage-label"
            label="Dung lượng đã dùng"
            usedText={formatStorage(storageUsedBytes)}
            limitText={formatStorageFromMb(storageLimitMb)}
            ratio={storageLimitMb > 0 ? storageUsedBytes / (storageLimitMb * 1024 * 1024) : storageUsedBytes > 0 ? 1 : 0}
          />
        ) : (
          <p className="text-sm" style={{ color: brandColors.ink }}>
            <span className="font-medium">Dung lượng đã dùng: </span>
            <span className="tabular-nums">{formatStorage(storageUsedBytes)}</span>
            <span className="text-gray-600"> — chưa có gói nên không có hạn mức.</span>
          </p>
        )}

        {maxProducts !== null ? (
          <UsageBar
            id="tenant-products-label"
            label="Tài liệu đã xuất bản"
            usedText={numberFormat.format(products.PUBLISHED)}
            limitText={numberFormat.format(maxProducts)}
            ratio={maxProducts > 0 ? products.PUBLISHED / maxProducts : products.PUBLISHED > 0 ? 1 : 0}
          />
        ) : null}
      </div>
    </section>
  );
}

// ───────────────────────── Vi phạm ─────────────────────────

const REPORT_STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = { OPEN: "warning", RESOLVED: "success", REJECTED: "neutral" };

export function AbuseSection({ abuse }: { abuse: AdminTenantDetail["abuse"] }) {
  const typeLabels: Record<string, string> = ABUSE_REPORT_TYPE_LABELS;
  const targetLabels: Record<string, string> = ABUSE_TARGET_TYPE_LABELS;
  const statusLabels: Record<string, string> = ABUSE_REPORT_STATUS_LABELS;
  const totalReports = ABUSE_REPORT_STATUSES.reduce((sum, status) => sum + (abuse.counts[status] ?? 0), 0);

  return (
    <section aria-labelledby="tenant-abuse-title">
      <SectionHeading
        id="tenant-abuse-title"
        icon={<IconFlag className={ICON} />}
        title="Vi phạm"
        description="Báo cáo vi phạm liên quan đến gian hàng và yêu cầu hoàn tiền gói quá hạn."
      />
      <div className={`${CARD} space-y-5`} style={{ borderColor: LINE }}>
        <dl className="grid grid-cols-3 gap-3">
          {ABUSE_REPORT_STATUSES.map((status) => (
            <StatTile key={status} label={statusLabels[status] ?? status} value={numberFormat.format(abuse.counts[status] ?? 0)} />
          ))}
        </dl>

        <div>
          <h3 className="font-[family-name:var(--font-heading)] text-sm font-semibold" style={{ color: brandColors.ink }}>
            5 báo cáo gần nhất
          </h3>
          {totalReports === 0 || abuse.recent.length === 0 ? (
            <div className="mt-2">
              <CompactEmpty>Gian hàng chưa bị báo cáo vi phạm.</CompactEmpty>
            </div>
          ) : (
            <ul className="mt-1 divide-y divide-gray-100">
              {abuse.recent.map((report) => (
                <li key={report.id} className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium" style={{ color: brandColors.ink }}>
                      {typeLabels[report.type] ?? report.type}
                    </p>
                    <p className="text-xs text-gray-600">Đối tượng: {(targetLabels[report.targetType] ?? report.targetType).toLowerCase()}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Badge tone={REPORT_STATUS_TONE[report.status] ?? "neutral"}>{statusLabels[report.status] ?? report.status}</Badge>
                    <time dateTime={report.createdAt.toISOString()} className="text-xs text-gray-600 tabular-nums">
                      {formatAdminDateTime(report.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t pt-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: LINE }}>
          <p className="text-sm" style={{ color: brandColors.ink }}>
            {abuse.overdueRefundRequests > 0 ? (
              <Badge tone="danger">{numberFormat.format(abuse.overdueRefundRequests)} yêu cầu hoàn tiền quá hạn</Badge>
            ) : (
              <span className="text-gray-600">Không có yêu cầu hoàn tiền quá hạn.</span>
            )}
          </p>
          <TextLink href="/admin/reports?status=ALL">Xem trang Báo cáo vi phạm</TextLink>
        </div>
      </div>
    </section>
  );
}
