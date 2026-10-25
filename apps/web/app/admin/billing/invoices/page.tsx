import { getEffectiveBrand } from "../../../../lib/branding";
import { requireAdminAccess } from "../../../../lib/page-guards";
import {
  ADMIN_INVOICE_PROVIDERS,
  ADMIN_INVOICE_STATUSES,
  listPendingManualInvoices,
  listSubscriptionInvoices,
  parseEnumParam,
} from "../../../../lib/subscription-billing";
import { AdminPageHeader, Badge, DataTable, EmptyState, FilterBar, FilterSelect, GhostLinkButton, PillTabs, Td, Tr } from "../../_ui/kit";
import { IconReceipt } from "../../_ui/icons";
import { Pagination } from "../../_ui/pagination";
import { parsePagination } from "../../_ui/pagination-utils";
import { formatVndFull } from "../../_ui/stats-chart";
import {
  INVOICE_PROVIDER_LABEL,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  formatAdminDateTime,
} from "../../_ui/billing-labels";
import { ConfirmButton } from "./confirm-button";

type InvoiceTab = "cho-doi-soat" | "tat-ca";

const BASE_PATH = "/admin/billing/invoices";
const ALL_TAB_PATH = `${BASE_PATH}?tab=tat-ca`;

const TABS: { value: InvoiceTab; label: string }[] = [
  { value: "cho-doi-soat", label: "Chờ đối soát" },
  { value: "tat-ca", label: "Tất cả" },
];

/** Cột phụ: ẩn trên mobile (thông tin chính vẫn còn ở các cột khác), hiện từ md/lg. */
const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";

export default async function AdminBillingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; provider?: string; page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/billing/invoices");
  const sp = await searchParams;
  const tab: InvoiceTab = sp.tab === "tat-ca" ? "tat-ca" : "cho-doi-soat";

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Hoá đơn gói dịch vụ"
        subtitle={tab === "cho-doi-soat" ? await pendingSubtitle() : "Mọi hoá đơn gói của các gian hàng, mới nhất trước — lọc theo trạng thái và cổng thanh toán."}
      />

      <PillTabs
        label="Nhóm hoá đơn"
        items={TABS.map((item) => ({ href: `${BASE_PATH}?tab=${item.value}`, label: item.label, active: item.value === tab }))}
      />

      {tab === "cho-doi-soat" ? <PendingTab /> : <AllInvoicesTab sp={sp} />}
    </div>
  );
}

async function pendingSubtitle(): Promise<string> {
  const brand = await getEffectiveBrand();
  return `Kiểm tra sao kê ngân hàng của ${brand.name} rồi xác nhận từng hoá đơn QR thủ công khớp nội dung chuyển khoản (nội dung = mã hoá đơn).`;
}

async function PendingTab() {
  const invoices = await listPendingManualInvoices();

  if (invoices.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<IconReceipt className="h-6 w-6" />}
          title="Không có hoá đơn nào đang chờ đối soát"
          description="Mọi hoá đơn QR thủ công đã được đối soát. Xem lịch sử ở tab “Tất cả”."
          action={<GhostLinkButton href={ALL_TAB_PATH}>Xem tất cả hoá đơn</GhostLinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-gray-600">
        {invoices.length.toLocaleString("vi-VN")} hoá đơn QR thủ công chờ đối soát, cũ nhất trước.
      </p>
      <div className="overflow-x-auto">
        <DataTable
          head={["Mã hoá đơn", "Gian hàng", "Gói", "Số tiền", "Hạn thanh toán", <span key="act" className="sr-only">Thao tác</span>]}
          headClassName={[undefined, undefined, HIDE_BELOW_MD, "text-right", HIDE_BELOW_MD, "text-right"]}
          caption="Hoá đơn QR thủ công chờ đối soát"
        >
          {invoices.map((invoice) => (
            <Tr key={invoice.id}>
              <Td className="font-mono text-xs whitespace-nowrap">{invoice.code}</Td>
              <Td>
                <span className="font-medium">{invoice.tenant.name}</span>
                <span className="block text-xs text-gray-500">/{invoice.tenant.slug}</span>
                <span className="block text-xs text-gray-500 md:hidden">Gói: {invoice.plan.name}</span>
              </Td>
              <Td className={HIDE_BELOW_MD}>{invoice.plan.name}</Td>
              <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatVndFull(invoice.amountVnd)}</Td>
              <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_MD}`}>{formatAdminDateTime(invoice.dueAt)}</Td>
              <Td className="text-right">
                <ConfirmButton invoiceId={invoice.id} invoiceCode={invoice.code} />
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}

async function AllInvoicesTab({ sp }: { sp: { status?: string; provider?: string; page?: string; pageSize?: string } }) {
  const status = parseEnumParam(ADMIN_INVOICE_STATUSES, sp.status);
  const provider = parseEnumParam(ADMIN_INVOICE_PROVIDERS, sp.provider);
  const { page, pageSize } = parsePagination(sp);
  const { items, total } = await listSubscriptionInvoices({ status, provider, page, pageSize });
  const filtered = Boolean(status || provider);

  return (
    <>
      <FilterBar
        action={BASE_PATH}
        label="Lọc hoá đơn"
        hidden={{ tab: "tat-ca", pageSize: sp.pageSize }}
        active={filtered}
        clearHref={ALL_TAB_PATH}
      >
        <FilterSelect
          label="Trạng thái"
          name="status"
          value={status}
          allLabel="Tất cả trạng thái"
          options={ADMIN_INVOICE_STATUSES.map((value) => ({ value, label: INVOICE_STATUS_LABEL[value] }))}
        />
        <FilterSelect
          label="Cổng thanh toán"
          name="provider"
          value={provider}
          allLabel="Tất cả cổng"
          options={ADMIN_INVOICE_PROVIDERS.map((value) => ({ value, label: INVOICE_PROVIDER_LABEL[value] }))}
        />
      </FilterBar>

      <div className="mt-4">
        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<IconReceipt className="h-6 w-6" />}
              title="Không có hoá đơn nào khớp bộ lọc"
              description="Thử chọn trạng thái hoặc cổng thanh toán khác."
              action={<GhostLinkButton href={ALL_TAB_PATH}>Xoá bộ lọc</GhostLinkButton>}
            />
          ) : (
            <EmptyState
              icon={<IconReceipt className="h-6 w-6" />}
              title="Chưa có hoá đơn gói nào"
              description="Hoá đơn được tạo khi một gian hàng nâng cấp hoặc gia hạn gói trả phí."
            />
          )
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600" aria-live="polite">
              {filtered ? "Khớp bộ lọc: " : "Tổng: "}
              {total.toLocaleString("vi-VN")} hoá đơn
            </p>
            <div className="overflow-x-auto">
              <DataTable
                head={[
                  "Mã hoá đơn",
                  "Gian hàng",
                  "Gói",
                  "Cổng",
                  "Số tiền",
                  "Trạng thái",
                  "Ngày tạo",
                  "Hạn thanh toán",
                  "Ngày thu",
                  <span key="act" className="sr-only">Thao tác</span>,
                ]}
                headClassName={[undefined, undefined, HIDE_BELOW_MD, HIDE_BELOW_MD, "text-right", undefined, HIDE_BELOW_LG, HIDE_BELOW_LG, HIDE_BELOW_MD, "text-right"]}
                caption="Tất cả hoá đơn gói dịch vụ"
              >
                {items.map((invoice) => (
                  <Tr key={invoice.id}>
                    <Td className="font-mono text-xs whitespace-nowrap">{invoice.code}</Td>
                    <Td>
                      <span className="font-medium">{invoice.tenant.name}</span>
                      <span className="block text-xs text-gray-500">/{invoice.tenant.slug}</span>
                      <span className="block text-xs text-gray-500 md:hidden">
                        {invoice.plan.name} · {INVOICE_PROVIDER_LABEL[invoice.provider]}
                      </span>
                    </Td>
                    <Td className={HIDE_BELOW_MD}>{invoice.plan.name}</Td>
                    <Td className={`whitespace-nowrap ${HIDE_BELOW_MD}`}>{INVOICE_PROVIDER_LABEL[invoice.provider]}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatVndFull(invoice.amountVnd)}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
                    </Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>{formatAdminDateTime(invoice.createdAt)}</Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_LG}`}>{formatAdminDateTime(invoice.dueAt)}</Td>
                    <Td className={`whitespace-nowrap text-gray-600 tabular-nums ${HIDE_BELOW_MD}`}>
                      {invoice.paidAt ? (
                        formatAdminDateTime(invoice.paidAt)
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Chưa thu</span>
                        </>
                      )}
                    </Td>
                    <Td className="text-right">
                      {invoice.provider === "MANUAL_QR" && invoice.status === "PENDING" ? (
                        <ConfirmButton invoiceId={invoice.id} invoiceCode={invoice.code} />
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </>
  );
}
