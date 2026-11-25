import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isManualConfirmProvider } from "@gieochu/payments";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getAdminSubscriptionDetail } from "../../../../lib/subscription-billing";
import { AdminPageHeader, Badge, DataTable, EmptyState, GhostLinkButton, Td, Tr } from "../../_ui/kit";
import { IconChevronLeft, IconClock, IconPackage, IconReceipt } from "../../_ui/icons";
import { formatVndFull } from "../../_ui/stats-chart";
import {
  INVOICE_PROVIDER_LABEL,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  formatAdminDate,
  formatAdminDateTime,
} from "../../_ui/billing-labels";
import { InvoiceStatusButton } from "../../billing/invoices/confirm-button";

export const metadata: Metadata = { title: "Chi tiết đơn hàng gói dịch vụ" };

const LIST_PATH = "/admin/subscriptions";
const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";
const CARD = "rounded-2xl border bg-white p-5 sm:p-6";
const LINE = "#E5E7EB";

function Dash({ srText }: { srText: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{srText}</span>
    </>
  );
}

/** Nhãn trạng thái hoá đơn trong nhật ký (giá trị lạ → giữ nguyên mã). */
function invoiceStatusText(status: string): string {
  return (INVOICE_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function SectionHeading({ id, icon, title, description }: { id: string; icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: brandColors.surface, color: brandColors.primary }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: brandColors.ink }}>
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm" style={{ color: brandColors.inkSoft }}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * ADR-069 — chi tiết một thuê bao gói dịch vụ (System Admin): thông tin thuê bao, lịch sử hoá đơn gói của gian hàng (mới nhất
 * trước, mỗi hoá đơn đổi được trạng thái theo `statusTargets` — ADR-067) và nhật ký thao tác (audit). Chỉ dữ liệu L1 + audit,
 * không đọc đơn hàng/khách của gian hàng (§7.9). Không có thuê bao → 404.
 */
export default async function AdminSubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const { subscriptionId } = await params;
  await requireAdminAccess(`${LIST_PATH}/${subscriptionId}`);
  const detail = await getAdminSubscriptionDetail(subscriptionId);
  if (!detail) notFound();

  const info: { label: string; value: ReactNode }[] = [
    {
      label: "Gian hàng",
      value: (
        <>
          <span className="block font-semibold [overflow-wrap:anywhere]">{detail.tenant.name}</span>
          <span className="block text-xs text-gray-500 [overflow-wrap:anywhere]">/{detail.tenant.slug}</span>
        </>
      ),
    },
    {
      label: "Gói",
      value: (
        <>
          <span className="block font-semibold">{detail.plan.name}</span>
          <span className="block text-xs text-gray-500 tabular-nums">{detail.plan.isFree ? "Miễn phí" : `Giá gói ${formatVndFull(detail.plan.priceVnd)}`}</span>
        </>
      ),
    },
    {
      label: "Trạng thái",
      value: <Badge tone={SUBSCRIPTION_STATUS_TONE[detail.status]}>{SUBSCRIPTION_STATUS_LABEL[detail.status]}</Badge>,
    },
    { label: "Bắt đầu kỳ", value: <span className="tabular-nums">{formatAdminDate(detail.currentPeriodStart)}</span> },
    {
      label: "Hết hạn",
      value: detail.plan.isFree ? "Không thời hạn" : <span className="tabular-nums">{formatAdminDate(detail.currentPeriodEnd)}</span>,
    },
    {
      label: "Hạn ân hạn",
      value: detail.graceEndsAt ? (
        <span className="tabular-nums">{formatAdminDate(detail.graceEndsAt)}</span>
      ) : (
        <span className="text-gray-500">
          <Dash srText="Không có" />
        </span>
      ),
    },
  ];

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Chi tiết đơn hàng gói dịch vụ"
        subtitle={
          <>
            Thuê bao của gian hàng <strong className="font-semibold">{detail.tenant.name}</strong> — hoá đơn gói và nhật ký thao tác.
          </>
        }
        action={
          <GhostLinkButton href={LIST_PATH}>
            <IconChevronLeft className="h-4 w-4" /> Đơn hàng gói dịch vụ
          </GhostLinkButton>
        }
      />

      <div className="mt-6 space-y-8">
        <section aria-labelledby="sub-info-title">
          <SectionHeading id="sub-info-title" icon={<IconPackage className="h-4 w-4" />} title="Thông tin thuê bao" />
          <div className={CARD} style={{ borderColor: LINE }}>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {info.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-xs font-medium text-gray-600">{item.label}</dt>
                  <dd className="mt-1 text-sm" style={{ color: brandColors.ink }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="sub-invoices-title">
          <SectionHeading
            id="sub-invoices-title"
            icon={<IconReceipt className="h-4 w-4" />}
            title="Lịch sử hoá đơn gói"
            description="Mọi hoá đơn gói của gian hàng, mới nhất trước."
          />
          {detail.invoices.length === 0 ? (
            <EmptyState
              icon={<IconReceipt className="h-6 w-6" />}
              title="Chưa có hoá đơn gói nào"
              description="Hoá đơn được tạo khi gian hàng nâng cấp hoặc gia hạn gói trả phí."
            />
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                caption="Lịch sử hoá đơn gói của gian hàng"
                head={[
                  "Mã hoá đơn",
                  "Số tiền",
                  "Cổng",
                  "Trạng thái",
                  "Ngày tạo",
                  "Hạn thanh toán",
                  "Ngày thu",
                  <span key="act" className="sr-only">
                    Thao tác
                  </span>,
                ]}
                headClassName={[undefined, "text-right", HIDE_BELOW_MD, undefined, HIDE_BELOW_LG, HIDE_BELOW_LG, HIDE_BELOW_MD, "text-right"]}
              >
                {detail.invoices.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td>
                      <span className="block font-mono text-xs font-semibold [overflow-wrap:anywhere]">{invoice.code}</span>
                      <span className="mt-0.5 block text-xs text-gray-500 tabular-nums">
                        Kỳ {formatAdminDate(invoice.periodStart)} – {formatAdminDate(invoice.periodEnd)}
                      </span>
                      {/* Dưới md/lg các cột phụ ẩn → lặp cổng + ngày tạo ở đây. */}
                      <span className="block text-xs text-gray-500 md:hidden">{INVOICE_PROVIDER_LABEL[invoice.provider]}</span>
                      <span className="block text-xs text-gray-500 tabular-nums lg:hidden">Tạo {formatAdminDateTime(invoice.createdAt)}</span>
                    </Td>
                    <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatVndFull(invoice.amountVnd)}</Td>
                    <Td className={`whitespace-nowrap ${HIDE_BELOW_MD}`}>{INVOICE_PROVIDER_LABEL[invoice.provider]}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
                    </Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>{formatAdminDateTime(invoice.createdAt)}</Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>{formatAdminDateTime(invoice.dueAt)}</Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_MD}`}>
                      {invoice.paidAt ? formatAdminDateTime(invoice.paidAt) : <Dash srText="Chưa thu" />}
                    </Td>
                    <Td className="text-right">
                      {invoice.statusTargets.length > 0 ? (
                        <InvoiceStatusButton
                          invoiceId={invoice.id}
                          invoiceCode={invoice.code}
                          amountLabel={formatVndFull(invoice.amountVnd)}
                          providerLabel={INVOICE_PROVIDER_LABEL[invoice.provider]}
                          currentStatusLabel={INVOICE_STATUS_LABEL[invoice.status]}
                          targets={invoice.statusTargets}
                          expired={invoice.status === "EXPIRED"}
                          autoProvider={!isManualConfirmProvider(invoice.provider)}
                        />
                      ) : (
                        <span className="text-gray-500">
                          <Dash srText="Không có thao tác" />
                        </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
          )}
        </section>

        <section aria-labelledby="sub-activity-title">
          <SectionHeading
            id="sub-activity-title"
            icon={<IconClock className="h-4 w-4" />}
            title="Nhật ký thao tác"
            description="Xác nhận, huỷ, mở lại và thanh toán hoá đơn gói, mới nhất trước. Giờ Việt Nam."
          />
          {detail.activity.length === 0 ? (
            <EmptyState icon={<IconClock className="h-6 w-6" />} title="Chưa có thao tác nào" description="Thao tác trên hoá đơn gói của gian hàng sẽ hiện ở đây." />
          ) : (
            <ol className="divide-y divide-gray-100 rounded-2xl border bg-white px-5 sm:px-6" style={{ borderColor: LINE }}>
              {detail.activity.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                  <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-xs text-gray-600 tabular-nums sm:w-36 sm:pt-0.5">
                    {formatAdminDateTime(entry.createdAt)}
                  </time>
                  <div className="min-w-0 flex-1 text-sm" style={{ color: brandColors.ink }}>
                    <p>
                      <span className="font-semibold">{entry.actionLabel}</span>
                      <span className="text-gray-600"> · {entry.actorLabel ?? "Hệ thống"}</span>
                    </p>
                    {entry.invoiceCode || entry.fromStatus || entry.toStatus ? (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                        {entry.invoiceCode ? (
                          <span>
                            Hoá đơn <span className="font-mono [overflow-wrap:anywhere]">{entry.invoiceCode}</span>
                          </span>
                        ) : null}
                        {entry.fromStatus || entry.toStatus ? (
                          <span>
                            {entry.fromStatus ? invoiceStatusText(entry.fromStatus) : "—"}
                            <span aria-hidden="true"> → </span>
                            <span className="sr-only"> chuyển sang </span>
                            {entry.toStatus ? invoiceStatusText(entry.toStatus) : "—"}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {entry.note ? (
                      <p className="mt-2 rounded-lg border-l-4 bg-gray-50 px-3 py-2 text-sm whitespace-pre-line [overflow-wrap:anywhere]" style={{ borderColor: LINE }}>
                        <span className="sr-only">Ghi chú: </span>
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
