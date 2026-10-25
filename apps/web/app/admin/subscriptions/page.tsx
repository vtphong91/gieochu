import Link from "next/link";
import { requireAdminAccess } from "../../../lib/page-guards";
import { ADMIN_SUBSCRIPTION_STATUSES, listPlanFilterOptions, listSubscriptions, parseEnumParam } from "../../../lib/subscription-billing";
import { AdminPageHeader, Badge, DataTable, EmptyState, FilterBar, FilterSelect, GhostLinkButton, Td, Tr } from "../_ui/kit";
import { IconPackage } from "../_ui/icons";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  formatAdminDate,
} from "../_ui/billing-labels";

const BASE_PATH = "/admin/subscriptions";
const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";

function Dash({ srText }: { srText: string }) {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{srText}</span>
    </>
  );
}

/**
 * ADR-056 mục 2 (+ bổ sung: nhãn "Đơn hàng") — danh sách thuê bao gói dịch vụ (L1: subscriptions/plans/subscription_invoices + tên/slug gian hàng).
 * Không đọc đơn hàng/khách hàng của tenant (§7.9).
 */
export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; status?: string; page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/subscriptions");
  const sp = await searchParams;
  const plans = await listPlanFilterOptions();
  const planCode = plans.some((p) => p.code === sp.plan) ? sp.plan : undefined;
  const status = parseEnumParam(ADMIN_SUBSCRIPTION_STATUSES, sp.status);
  const { page, pageSize } = parsePagination(sp);
  const { items, total } = await listSubscriptions({ planCode, status, page, pageSize });
  const filtered = Boolean(planCode || status);

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Đơn hàng gói dịch vụ"
        subtitle="Thuê bao gói dịch vụ của các gian hàng (không phải đơn hàng tài liệu của gian hàng), sắp theo ngày hết hạn gần nhất; gói miễn phí xếp cuối."
        action={<GhostLinkButton href="/admin/billing/invoices?tab=tat-ca">Xem hoá đơn gói</GhostLinkButton>}
      />

      <FilterBar action={BASE_PATH} label="Lọc đơn hàng gói dịch vụ" hidden={{ pageSize: sp.pageSize }} active={filtered} clearHref={BASE_PATH}>
        <FilterSelect label="Gói" name="plan" value={planCode} allLabel="Tất cả gói" options={plans.map((plan) => ({ value: plan.code, label: plan.name }))} />
        <FilterSelect
          label="Trạng thái"
          name="status"
          value={status}
          allLabel="Tất cả trạng thái"
          options={ADMIN_SUBSCRIPTION_STATUSES.map((value) => ({ value, label: SUBSCRIPTION_STATUS_LABEL[value] }))}
        />
      </FilterBar>

      <div className="mt-4">
        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<IconPackage className="h-6 w-6" />}
              title="Không có thuê bao nào khớp bộ lọc"
              description="Thử chọn gói hoặc trạng thái khác."
              action={<GhostLinkButton href={BASE_PATH}>Xoá bộ lọc</GhostLinkButton>}
            />
          ) : (
            <EmptyState
              icon={<IconPackage className="h-6 w-6" />}
              title="Chưa có thuê bao nào"
              description="Mỗi gian hàng mới tạo sẽ có một thuê bao và hiện ở đây."
            />
          )
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600" aria-live="polite">
              {filtered ? "Khớp bộ lọc: " : "Tổng: "}
              {total.toLocaleString("vi-VN")} thuê bao
            </p>
            <div className="overflow-x-auto">
              <DataTable
                head={["Gian hàng", "Gói", "Trạng thái", "Bắt đầu chu kỳ", "Hết hạn", "Hạn ân hạn", "Hoá đơn gần nhất"]}
                headClassName={[undefined, HIDE_BELOW_MD, undefined, HIDE_BELOW_LG, undefined, HIDE_BELOW_LG, HIDE_BELOW_MD]}
                caption="Đơn hàng gói dịch vụ"
              >
                {items.map((sub) => (
                  <Tr key={sub.id}>
                    <Td>
                      <Link
                        href="/admin/tenants"
                        className="font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
                      >
                        {sub.tenant.name}
                      </Link>
                      <span className="block text-xs text-gray-500">/{sub.tenant.slug}</span>
                      <span className="block text-xs text-gray-500 md:hidden">Gói: {sub.plan.name}</span>
                    </Td>
                    <Td className={HIDE_BELOW_MD}>{sub.plan.name}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={SUBSCRIPTION_STATUS_TONE[sub.status]}>{SUBSCRIPTION_STATUS_LABEL[sub.status]}</Badge>
                    </Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>{formatAdminDate(sub.currentPeriodStart)}</Td>
                    <Td className="whitespace-nowrap text-gray-600 tabular-nums">{sub.plan.isFree ? "Không thời hạn" : formatAdminDate(sub.currentPeriodEnd)}</Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>
                      {sub.graceEndsAt ? formatAdminDate(sub.graceEndsAt) : <Dash srText="Không có" />}
                    </Td>
                    <Td className={HIDE_BELOW_MD}>
                      {sub.latestInvoice ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">{sub.latestInvoice.code}</span>
                          <Badge tone={INVOICE_STATUS_TONE[sub.latestInvoice.status]}>{INVOICE_STATUS_LABEL[sub.latestInvoice.status]}</Badge>
                        </span>
                      ) : (
                        <span className="text-gray-500">
                          <Dash srText="Chưa có hoá đơn" />
                        </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </div>
  );
}
