import Link from "next/link";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listTenantTransactionsNeedingAction } from "../../../../../lib/tenant-payment-transactions";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../../../../admin/_ui/kit";
import { IconReceipt } from "../../../../admin/_ui/icons";
import { Pagination } from "../../../../admin/_ui/pagination";
import { formatVndFull } from "../../../../admin/_ui/stats-chart";
import { formatAdminDateTime } from "../../../../admin/_ui/billing-labels";
import { parsePagination } from "../../../../admin/_ui/pagination-utils";

const PROVIDER_LABEL: Record<string, string> = { SEPAY: "SePay", MOMO: "MoMo", MANUAL_QR: "QR thủ công", MOMO_MANUAL: "MoMo (chuyển tay)" };

/**
 * ADR-059 bổ sung lần 2 (d) — "Giao dịch cần xử lý": giao dịch cổng của gian hàng không tự áp vào đơn (không tìm thấy đơn / sai
 * số tiền). Dữ liệu L2 qua `withTenant`. Markup tối thiểu — Phong rà lại trình bày sau.
 */
export default async function StudioTransactionsNeedingActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders/giao-dich`);
  const paging = parsePagination(sp);
  const { items, total, page, pageSize } = await listTenantTransactionsNeedingAction(tenant.id, paging.page, paging.pageSize);
  const ordersPath = `/studio/${tenantSlug}/orders`;

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Giao dịch cần xử lý"
        subtitle="Giao dịch SePay/MoMo không tự giao được tài liệu: không tìm thấy đơn theo nội dung chuyển khoản, hoặc sai số tiền. Đối chiếu sao kê rồi xác nhận tay ở trang đơn (nếu đơn còn trong thời hạn xác nhận) hoặc liên hệ khách."
      />
      <p className="mb-4 text-sm">
        <Link href={ordersPath} className="font-medium text-[color:var(--color-primary)] hover:underline">
          ← Quay lại danh sách đơn hàng
        </Link>
      </p>

      {items.length === 0 ? (
        <EmptyState
          icon={<IconReceipt className="h-6 w-6" />}
          title="Không có giao dịch nào cần xử lý"
          description="Mọi giao dịch nhận qua cổng thanh toán đều đã khớp đúng đơn và đúng số tiền."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600">{total.toLocaleString("vi-VN")} giao dịch, mới nhất trước.</p>
          <div className="overflow-x-auto">
            <DataTable head={["Thời điểm nhận", "Cổng", "Số tiền", "Tình trạng", "Đơn hàng", "Nội dung"]} caption="Giao dịch cần xử lý">
              {items.map((row) => {
                const diff = row.order ? row.amountVnd - row.order.totalVnd : null;
                return (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap text-gray-600 tabular-nums">
                      {formatAdminDateTime(row.createdAt)}
                      <span className="block font-mono text-xs text-gray-500">#{row.providerTxnId}</span>
                    </Td>
                    <Td className="whitespace-nowrap">{PROVIDER_LABEL[row.provider] ?? row.provider}</Td>
                    <Td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatVndFull(row.amountVnd)}</Td>
                    <Td>
                      <Badge tone={row.matchStatus === "MISMATCH_AMOUNT" ? "danger" : "warning"}>
                        {row.matchStatus === "MISMATCH_AMOUNT" ? "Sai số tiền" : "Không tìm thấy đơn"}
                      </Badge>
                      {diff !== null && diff !== 0 ? (
                        <span className="mt-1 block text-xs text-gray-600">
                          {diff < 0 ? `Thiếu ${formatVndFull(-diff)}` : `Thừa ${formatVndFull(diff)}`} so với đơn ({formatVndFull(row.order!.totalVnd)}).
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      {row.order ? (
                        <Link href={`${ordersPath}/${row.order.id}`} className="font-mono text-xs text-[color:var(--color-primary)] hover:underline">
                          {row.order.code}
                        </Link>
                      ) : (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Không có đơn</span>
                        </>
                      )}
                    </Td>
                    <Td className="max-w-72 text-xs text-gray-600 [overflow-wrap:anywhere]">{row.content ?? "—"}</Td>
                  </Tr>
                );
              })}
            </DataTable>
          </div>
          <Pagination total={total} page={page} pageSize={pageSize} />
        </>
      )}
    </div>
  );
}
