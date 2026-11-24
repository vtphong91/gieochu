import { getEffectiveBrand } from "../../../../lib/branding";
import { requireAdminAccess } from "../../../../lib/page-guards";
import {
  ADMIN_INVOICE_PROVIDERS,
  ADMIN_INVOICE_STATUSES,
  listPendingManualInvoices,
  listSubscriptionInvoices,
  parseEnumParam,
} from "../../../../lib/subscription-billing";
import { isManualConfirmProvider } from "@gieochu/payments";
import { listPlatformTransactions, PLATFORM_TXN_FILTERS, type PlatformTxnRow } from "../../../../lib/platform-transactions";
import { AdminPageHeader, Badge, DataTable, EmptyState, FilterBar, FilterSelect, GhostLinkButton, PillTabs, Td, Tr } from "../../_ui/kit";
import { IconReceipt } from "../../_ui/icons";
import { Pagination } from "../../_ui/pagination";
import { parsePagination } from "../../_ui/pagination-utils";
import { formatVndFull } from "../../_ui/stats-chart";
import {
  INVOICE_PROVIDER_LABEL,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PLATFORM_TXN_FILTER_LABEL,
  PLATFORM_TXN_STATE_LABEL,
  PLATFORM_TXN_STATE_TONE,
  formatAdminDateTime,
} from "../../_ui/billing-labels";
import { ManualConfirmButton, TransactionConfirmButton } from "./confirm-button";

type InvoiceTab = "cho-doi-soat" | "tat-ca" | "giao-dich";

const BASE_PATH = "/admin/billing/invoices";
const ALL_TAB_PATH = `${BASE_PATH}?tab=tat-ca`;
const TXN_TAB_PATH = `${BASE_PATH}?tab=giao-dich`;

const TABS: { value: InvoiceTab; label: string }[] = [
  { value: "cho-doi-soat", label: "Chờ đối soát" },
  { value: "tat-ca", label: "Tất cả" },
  { value: "giao-dich", label: "Giao dịch cổng" },
];

/** Cột phụ: ẩn trên mobile (thông tin chính vẫn còn ở các cột khác), hiện từ md/lg. */
const HIDE_BELOW_MD = "hidden md:table-cell";
const HIDE_BELOW_LG = "hidden lg:table-cell";

export default async function AdminBillingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; provider?: string; loai?: string; page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/billing/invoices");
  const sp = await searchParams;
  const tab: InvoiceTab = sp.tab === "tat-ca" || sp.tab === "giao-dich" ? sp.tab : "cho-doi-soat";

  // Wrapper <div>: layout admin đã có <main>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Hoá đơn gói dịch vụ"
        subtitle={
          tab === "cho-doi-soat"
            ? await pendingSubtitle()
            : tab === "giao-dich"
              ? "Giao dịch SePay/MoMo của cổng thu phí gói nhận qua webhook, mới nhất trước — soát giao dịch sai tiền, thiếu mã hoặc khớp nhưng hoá đơn chưa thanh toán."
              : "Mọi hoá đơn gói của các gian hàng, mới nhất trước — lọc theo trạng thái và cổng thanh toán."
        }
      />

      <PillTabs
        label="Nhóm hoá đơn"
        items={TABS.map((item) => ({ href: `${BASE_PATH}?tab=${item.value}`, label: item.label, active: item.value === tab }))}
      />

      {tab === "cho-doi-soat" ? <PendingTab /> : tab === "giao-dich" ? <TransactionsTab sp={sp} /> : <AllInvoicesTab sp={sp} />}
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
                <ManualConfirmButton
                  invoiceId={invoice.id}
                  invoiceCode={invoice.code}
                  amountLabel={formatVndFull(invoice.amountVnd)}
                  providerLabel={INVOICE_PROVIDER_LABEL[invoice.provider]}
                  expired={false}
                  autoProvider={false}
                />
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
                      {/* ADR-066: xác nhận tay mọi cổng — hoá đơn chờ hoặc đã hết hạn. */}
                      {invoice.status === "PENDING" || invoice.status === "EXPIRED" ? (
                        <ManualConfirmButton
                          invoiceId={invoice.id}
                          invoiceCode={invoice.code}
                          amountLabel={formatVndFull(invoice.amountVnd)}
                          providerLabel={INVOICE_PROVIDER_LABEL[invoice.provider]}
                          expired={invoice.status === "EXPIRED"}
                          autoProvider={!isManualConfirmProvider(invoice.provider)}
                        />
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

function transactionHint(row: PlatformTxnRow): string | null {
  switch (row.state) {
    case "AMOUNT_MISMATCH":
      if (!row.invoice || row.differenceVnd === null) return null;
      return row.differenceVnd < 0
        ? `Thiếu ${formatVndFull(-row.differenceVnd)} so với hoá đơn ${row.invoice.code} (${formatVndFull(row.invoice.amountVnd)}) — không xác nhận được.`
        : `Thừa ${formatVndFull(row.differenceVnd)} so với hoá đơn ${row.invoice.code} (${formatVndFull(row.invoice.amountVnd)}).`;
    case "INVOICE_NOT_FOUND":
      return `Không có hoá đơn mã ${row.reference}.`;
    case "NO_REFERENCE":
      return "Nội dung chuyển khoản không có mã hoá đơn.";
    case "MATCHED_NOT_APPLIED":
      return row.invoice ? `Hoá đơn đang ở trạng thái “${INVOICE_STATUS_LABEL[row.invoice.status]}” khi tiền về.` : null;
    default:
      return null;
  }
}

/** Nội dung khung xác nhận cho hoá đơn đã biết: chênh lệch + hoá đơn hết hạn sẽ tính lại kỳ. */
function confirmHint(row: PlatformTxnRow): string | null {
  if (!row.invoice) return null;
  const parts: string[] = [];
  if (row.differenceVnd !== null && row.differenceVnd > 0) parts.push(`Thừa ${formatVndFull(row.differenceVnd)} — ghi vào nhật ký, bạn hoàn ngoài hệ thống.`);
  if (row.invoice.status === "EXPIRED") parts.push("Hoá đơn đã hết hạn: kỳ gói tính lại từ lúc xác nhận; bị chặn nếu gian hàng đã có hoá đơn mới hơn.");
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * ADR-059 (B2) — giao dịch cổng thu phí gói (`platform_payment_transactions`, L1). ADR-059 bổ sung lần 2: từ giao dịch SePay chưa
 * áp, admin xác nhận được hoá đơn đã chọn rõ (thiếu tiền bị chặn).
 */
async function TransactionsTab({ sp }: { sp: { loai?: string; page?: string; pageSize?: string } }) {
  const filter = parseEnumParam(PLATFORM_TXN_FILTERS, sp.loai);
  const { page, pageSize } = parsePagination(sp);
  const { items, total } = await listPlatformTransactions({ filter, page, pageSize });

  return (
    <>
      <FilterBar action={BASE_PATH} label="Lọc giao dịch" hidden={{ tab: "giao-dich", pageSize: sp.pageSize }} active={Boolean(filter)} clearHref={TXN_TAB_PATH}>
        <FilterSelect
          label="Tình trạng"
          name="loai"
          value={filter}
          allLabel="Tất cả giao dịch"
          options={PLATFORM_TXN_FILTERS.map((value) => ({ value, label: PLATFORM_TXN_FILTER_LABEL[value] }))}
        />
      </FilterBar>

      <div className="mt-4">
        {items.length === 0 ? (
          filter ? (
            <EmptyState
              icon={<IconReceipt className="h-6 w-6" />}
              title="Không có giao dịch nào khớp bộ lọc"
              description="Thử chọn tình trạng khác."
              action={<GhostLinkButton href={TXN_TAB_PATH}>Xoá bộ lọc</GhostLinkButton>}
            />
          ) : (
            <EmptyState
              icon={<IconReceipt className="h-6 w-6" />}
              title="Chưa có giao dịch cổng nào"
              description="Giao dịch xuất hiện khi SePay/MoMo gửi webhook về cổng thu phí gói của nền tảng."
            />
          )
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-600" aria-live="polite">
              {filter ? "Khớp bộ lọc: " : "Tổng: "}
              {total.toLocaleString("vi-VN")} giao dịch
            </p>
            <div className="overflow-x-auto">
              <DataTable
                head={["Thời điểm nhận", "Cổng", "Số tiền", "Nội dung", "Tình trạng", "Hoá đơn"]}
                headClassName={[undefined, HIDE_BELOW_MD, "text-right", HIDE_BELOW_LG, undefined, undefined]}
                caption="Giao dịch cổng thu phí gói"
              >
                {items.map((row) => {
                  const hint = transactionHint(row);
                  return (
                    <Tr key={row.id}>
                      <Td className="whitespace-nowrap text-gray-600 tabular-nums">
                        {formatAdminDateTime(row.createdAt)}
                        {row.providerTxnId ? <span className="block font-mono text-xs text-gray-500">#{row.providerTxnId}</span> : null}
                      </Td>
                      <Td className={`whitespace-nowrap ${HIDE_BELOW_MD}`}>{INVOICE_PROVIDER_LABEL[row.provider]}</Td>
                      <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatVndFull(row.amountVnd)}</Td>
                      <Td className={`max-w-72 text-xs text-gray-600 [overflow-wrap:anywhere] ${HIDE_BELOW_LG}`}>
                        {row.content ?? (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Không có nội dung</span>
                          </>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={PLATFORM_TXN_STATE_TONE[row.state]}>{PLATFORM_TXN_STATE_LABEL[row.state]}</Badge>
                        {row.duplicateOfInvoice ? (
                          <span className="mt-1 block text-xs font-medium text-red-700">Nhiều giao dịch khớp cùng hoá đơn — kiểm tra trả trùng.</span>
                        ) : null}
                        {hint ? <span className="mt-1 block text-xs text-gray-600">{hint}</span> : null}
                        {row.confirmable ? (
                          <TransactionConfirmButton
                            transactionId={row.id}
                            defaultInvoiceCode={row.invoice?.code ?? row.reference ?? ""}
                            receivedLabel={formatVndFull(row.amountVnd)}
                            hint={confirmHint(row)}
                          />
                        ) : null}
                      </Td>
                      <Td>
                        {row.invoice ? (
                          <>
                            <span className="font-mono text-xs whitespace-nowrap">{row.invoice.code}</span>
                            <span className="block text-xs text-gray-500">
                              {row.invoice.tenant.name} · {INVOICE_STATUS_LABEL[row.invoice.status]}
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Không có hoá đơn</span>
                          </>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </DataTable>
            </div>
            <Pagination total={total} page={page} pageSize={pageSize} />
          </>
        )}
      </div>
    </>
  );
}
