import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { REMEDY_REFUND_SLA_DAYS } from "@gieochu/core/entitlement-remedy";
import {
  ORDER_LIST_DEFAULT_PAGE_SIZE,
  ORDER_LIST_DEFAULT_SORT,
  ORDER_LIST_PAGE_SIZES,
  ORDER_LIST_SORTS,
  ORDER_LIST_STATUSES,
  buildOrderListSearch,
  type OrderListItem,
  type OrderListPage,
  type OrderListQuery,
  type OrderListSort,
} from "../../../../../lib/order";
import { Badge, DataTable, EmptyState, Notice, Td, Tr } from "../../../../admin/_ui/kit";
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconReceipt } from "../../../../admin/_ui/icons";
import { LinkPagination } from "../../../../admin/_ui/link-pagination";
import { DashboardDateRangePicker } from "../../../../admin/_ui/date-range-picker";
import { RefundRequestBadge } from "./remedy-parts";
import { DeclaredPaidBadge } from "./declared-paid";
import { OrderRowActions } from "./order-row-actions";
import { OrderFilterForm } from "./order-filter-form";
import {
  ORDER_SORT_LABEL,
  ORDER_STATUS_LABEL,
  formatOrderDate,
  formatOrderPrice,
  formatOrderTime,
  hrefWithSearch,
  orderDetailHref,
  orderStatusLabel,
  orderStatusTone,
} from "./order-format";

/*
 * ADR-046 mục 1 — trang danh sách Đơn hàng Studio (Server Component; chỉ ô chọn ngày + menu dòng là client).
 * - Thanh lọc là form GET (`OrderFilterForm`: có JS thì bỏ ô rỗng/mặc định rồi `router.push`; `loading.tsx` hiện khi chờ). Tên ô = tham số
 *   của `parseOrderListQuery` (`q`, `trang-thai`, `remedy`, `san-pham`, `ky/tu/den`, `sap-xep`, `so-dong`). Ô chọn ngày dùng
 *   lại `DashboardDateRangePicker` ở `formMode` (ghi `ky/tu/den` rồi gửi form). `sap-xep` ẩn từ xl (đổi bằng tiêu đề
 *   cột) nhưng vẫn nằm trong form để giữ thứ tự khi lọc lại.
 * - Bảng từ `xl` (sidebar Studio 288px chiếm chỗ ở lg); dưới `xl` là danh sách thẻ (không cuộn ngang ở 360px).
 * - Khách: họ tên + email (không SĐT/địa chỉ — ADR-041). Tiền đầy đủ, 0 đ = "Miễn phí".
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PRIMARY = brandColors.primary;
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const WRAP_ANY = "min-w-0 [overflow-wrap:anywhere]";
const BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition lg:min-h-10 ${FOCUS}`;
const CONTROL =
  "block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-[15px] outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 lg:min-h-10 lg:text-sm";
const FIELD_LABEL = "mb-1.5 block text-sm font-medium";
const ACTIONS_ANCHOR = "order-actions";

const vnInt = new Intl.NumberFormat("vi-VN");

/** Số điều kiện lọc đang bật (không tính sắp xếp/phân trang). */
export function countActiveOrderFilters(query: OrderListQuery): number {
  return [query.q, query.status, query.remedy, query.productId, query.range, query.customerId].filter(Boolean).length;
}

// ───────────────────────── Thanh lọc ─────────────────────────

export function OrderFilterBar({
  basePath,
  data,
  today,
}: {
  basePath: string;
  data: Pick<OrderListPage, "query" | "statusCounts" | "refundRequestCount" | "products" | "customer">;
  /** `YYYY-MM-DD` giờ VN (server). */
  today: string;
}) {
  const { query } = data;
  const active = countActiveOrderFilters(query);
  // `key` theo bộ lọc đã áp dụng: sau "Xoá lọc"/điều hướng, các ô (defaultValue) dựng lại đúng giá trị mới.
  const formKey = buildOrderListSearch(query, { page: 1 });

  return (
    <OrderFilterForm
      action={basePath}
      defaults={{ "sap-xep": ORDER_LIST_DEFAULT_SORT, "so-dong": String(ORDER_LIST_DEFAULT_PAGE_SIZE) }}
      className="mt-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
      <div key={formKey} className="space-y-4">
        {/* ADR-048: đang xem đơn của một khách (từ trang Khách hàng) — giữ `khach` khi lọc tiếp, có nút bỏ riêng. */}
        {data.customer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: LINE, background: brandColors.surface, color: INK }}>
            <input type="hidden" name="khach" value={data.customer.userId} />
            <p className={WRAP_ANY}>
              Đang xem đơn của khách <strong className="font-semibold">{data.customer.fullName ?? data.customer.email}</strong>
              {data.customer.fullName ? <span style={{ color: INK_SOFT }}> · {data.customer.email}</span> : null}
            </p>
            <Link
              href={hrefWithSearch(basePath, buildOrderListSearch(query, { customerId: null }))}
              className={`inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline underline-offset-2 lg:min-h-9 ${FOCUS}`}
              style={{ color: PRIMARY }}
            >
              Bỏ lọc khách
            </Link>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="order-q" className={FIELD_LABEL} style={{ color: INK }}>
              Tìm đơn hàng
            </label>
            <input
              id="order-q"
              type="search"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Mã đơn, họ tên hoặc email khách"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={100}
              className={CONTROL}
              style={{ color: INK }}
            />
          </div>
          <div className="flex gap-2">
            {active > 0 ? (
              <Link href={basePath} className={`${BTN} flex-1 border bg-white hover:bg-gray-50 sm:flex-none`} style={{ borderColor: LINE, color: INK }}>
                Xoá lọc
              </Link>
            ) : null}
            <button type="submit" className={`${BTN} flex-1 cursor-pointer text-white hover:brightness-110 sm:flex-none`} style={{ background: PRIMARY }}>
              Lọc
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(3,minmax(0,1fr))_auto_minmax(0,0.8fr)]">
          <div>
            <label htmlFor="order-status" className={FIELD_LABEL} style={{ color: INK }}>
              Trạng thái
            </label>
            <select id="order-status" name="trang-thai" defaultValue={query.status ?? ""} className={CONTROL} style={{ color: INK }}>
              <option value="">Tất cả trạng thái ({vnInt.format(data.statusCounts.ALL)})</option>
              {ORDER_LIST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]} ({vnInt.format(data.statusCounts[s])})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="order-remedy" className={FIELD_LABEL} style={{ color: INK }}>
              Hoàn tiền
            </label>
            <select id="order-remedy" name="remedy" defaultValue={query.remedy ?? ""} className={CONTROL} style={{ color: INK }}>
              <option value="">Tất cả</option>
              <option value="REFUND_REQUESTED">Có yêu cầu hoàn tiền ({vnInt.format(data.refundRequestCount)})</option>
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="order-product" className={FIELD_LABEL} style={{ color: INK }}>
              Tài liệu
            </label>
            <select id="order-product" name="san-pham" defaultValue={query.productId ?? ""} className={`${CONTROL} truncate`} style={{ color: INK }}>
              <option value="">Tất cả tài liệu</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <span aria-hidden="true" className={FIELD_LABEL} style={{ color: INK }}>
              Ngày tạo đơn
            </span>
            <DashboardDateRangePicker
              activeKey={query.range?.key ?? null}
              displayFrom={query.range?.displayFrom ?? today}
              displayTo={query.range?.displayTo ?? today}
              today={today}
              formMode={{ label: "Ngày tạo đơn", dialogTitle: "Chọn khoảng ngày tạo đơn", allowAll: true }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {/* Sắp xếp: dưới xl không có tiêu đề cột → chọn ở đây; từ xl ẩn (đổi bằng tiêu đề cột) nhưng vẫn gửi theo form. */}
            <div className="xl:hidden">
              <label htmlFor="order-sort" className={FIELD_LABEL} style={{ color: INK }}>
                Sắp xếp
              </label>
              <select id="order-sort" name="sap-xep" defaultValue={query.sort} className={CONTROL} style={{ color: INK }}>
                {ORDER_LIST_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="order-page-size" className={FIELD_LABEL} style={{ color: INK }}>
                Số dòng mỗi trang
              </label>
              <select id="order-page-size" name="so-dong" defaultValue={String(query.pageSize)} className={CONTROL} style={{ color: INK }}>
                {ORDER_LIST_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} đơn
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="text-xs" style={{ color: INK_SOFT }}>
          {active > 0 ? `Đang áp dụng ${active} điều kiện lọc.` : "Đang xem mọi đơn hàng."} Ngày giờ theo giờ Việt Nam.
        </p>
      </div>
    </OrderFilterForm>
  );
}

/** Nhắc yêu cầu hoàn tiền đang chờ / quá hạn (ADR-039) — chữ nói rõ, kèm link lọc nhanh. Ẩn khi đang xem đúng bộ lọc đó. */
export function RefundRequestNotice({ basePath, data }: { basePath: string; data: Pick<OrderListPage, "query" | "refundRequestCount" | "refundRequestOverdueCount"> }) {
  const pending = data.refundRequestCount;
  const overdue = data.refundRequestOverdueCount;
  if (pending === 0 || (data.query.remedy && overdue === 0)) return null;
  return (
    <div className="mt-4">
      <Notice tone="warning" icon={<IconAlertTriangle className="h-5 w-5" />}>
        <p>
          <strong className="font-semibold">{vnInt.format(pending)} đơn có yêu cầu hoàn tiền</strong> đang chờ xử lý
          {overdue > 0 ? (
            <>
              , trong đó <strong className="font-semibold">{vnInt.format(overdue)} đơn đã quá hạn {REMEDY_REFUND_SLA_DAYS} ngày</strong>
            </>
          ) : null}
          .
          {data.query.remedy ? null : (
            <>
              {" "}
              <Link href={`${basePath}?remedy=REFUND_REQUESTED`} className={`font-semibold underline underline-offset-2 ${FOCUS}`}>
                Xem các đơn này
              </Link>
            </>
          )}
        </p>
      </Notice>
    </div>
  );
}

// ───────────────────────── Ô hiển thị ─────────────────────────

function TimeCell({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} className="block tabular-nums">
      <span className="block whitespace-nowrap" style={{ color: INK }}>
        {formatOrderDate(date)}
      </span>
      <span className="block text-xs" style={{ color: INK_SOFT }}>
        {formatOrderTime(date)}
      </span>
    </time>
  );
}

function CustomerCell({ customer }: { customer: OrderListItem["customer"] }) {
  return (
    <div className="min-w-0">
      {customer.fullName ? (
        <p className={`font-semibold ${WRAP_ANY}`} style={{ color: INK }}>
          {customer.fullName}
        </p>
      ) : (
        <p className="italic" style={{ color: INK_SOFT }}>
          Chưa có họ tên
        </p>
      )}
      <p className={`text-xs ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
        {customer.email}
      </p>
    </div>
  );
}

function ItemsCell({ items }: { items: OrderListItem["items"] }) {
  const text = items.map((item) => item.productTitle).join(", ");
  return (
    <p className={`line-clamp-2 ${WRAP_ANY}`} style={{ color: INK }} title={text}>
      {text || "—"}
    </p>
  );
}

function StatusCell({ row }: { row: OrderListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={orderStatusTone(row.status)}>{orderStatusLabel(row.status)}</Badge>
      {row.refundRequested ? <RefundRequestBadge overdue={row.refundOverdue} /> : null}
      {/* ADR-062 Q1 — đơn có cờ này luôn xếp đầu danh sách. */}
      <DeclaredPaidBadge order={row} />
    </div>
  );
}

function MoneyCell({ vnd }: { vnd: number }) {
  return (
    <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: INK }}>
      {formatOrderPrice(vnd)}
    </span>
  );
}

// ───────────────────────── Tiêu đề cột sắp xếp ─────────────────────────

type SortColumn = "created" | "total";

const SORT_OF: Record<SortColumn, { desc: OrderListSort; asc: OrderListSort }> = {
  created: { desc: "moi-nhat", asc: "cu-nhat" },
  total: { desc: "tong-giam", asc: "tong-tang" },
};

function sortState(sort: OrderListSort, column: SortColumn): "ascending" | "descending" | undefined {
  if (sort === SORT_OF[column].desc) return "descending";
  if (sort === SORT_OF[column].asc) return "ascending";
  return undefined;
}

function SortHeader({ basePath, query, column, label }: { basePath: string; query: OrderListQuery; column: SortColumn; label: string }) {
  const current = sortState(query.sort, column);
  // Bấm cột đang sắp xếp giảm dần → tăng dần; còn lại → giảm dần trước (mới nhất / cao nhất).
  const next = current === "descending" ? SORT_OF[column].asc : SORT_OF[column].desc;
  const href = hrefWithSearch(basePath, buildOrderListSearch(query, { sort: next }));
  return (
    <Link
      href={href}
      scroll={false}
      className={`-mx-1 inline-flex min-h-9 items-center gap-1 rounded px-1 font-medium hover:underline ${FOCUS}`}
      style={{ color: current ? INK : INK_SOFT }}
    >
      {label}
      {current === "ascending" ? (
        <IconArrowUp className="h-3.5 w-3.5" />
      ) : current === "descending" ? (
        <IconArrowDown className="h-3.5 w-3.5" />
      ) : (
        <span aria-hidden="true" className="inline-flex flex-col opacity-60">
          <IconArrowUp className="-mb-1 h-3 w-3" />
          <IconArrowDown className="h-3 w-3" />
        </span>
      )}
      <span className="sr-only">, bấm để sắp xếp {next === SORT_OF[column].asc ? "tăng dần" : "giảm dần"}</span>
    </Link>
  );
}

// ───────────────────────── Danh sách ─────────────────────────

export function OrderList({ basePath, tenantSlug, data }: { basePath: string; tenantSlug: string; data: OrderListPage }) {
  const { query } = data;
  const active = countActiveOrderFilters(query);

  if (data.items.length === 0) {
    const onlyRemedy = Boolean(query.remedy) && active === 1;
    return (
      <div className="mt-6">
        <EmptyState
          icon={<IconReceipt className="h-6 w-6" />}
          title={onlyRemedy ? "Không có yêu cầu hoàn tiền nào đang chờ" : active > 0 ? "Không có đơn hàng phù hợp bộ lọc" : "Chưa có đơn hàng nào"}
          description={
            onlyRemedy
              ? "Khi khách chọn hoàn tiền cho tài liệu bị gỡ do vi phạm, đơn hàng sẽ hiện ở đây."
              : active > 0
                ? "Thử bỏ bớt điều kiện, đổi khoảng ngày hoặc tìm theo từ khoá khác."
                : "Đơn hàng xuất hiện ngay khi khách đặt mua tài liệu ở cửa hàng của bạn."
          }
          action={
            active > 0 ? (
              <Link href={basePath} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
                Xem tất cả đơn hàng
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const listSearch = buildOrderListSearch(query, { page: data.page });
  const caption = `Danh sách đơn hàng, ${vnInt.format(data.total)} đơn${active > 0 ? " khớp bộ lọc" : ""}, trang ${data.page}/${data.pageCount}`;
  const rowProps = (row: OrderListItem) => ({
    tenantSlug,
    orderId: row.id,
    code: row.code,
    detailHref: orderDetailHref(basePath, row.id, listSearch),
    actionsHref: orderDetailHref(basePath, row.id, listSearch, ACTIONS_ANCHOR),
    actions: row.allowedActions,
  });

  return (
    <section aria-labelledby="order-list-title" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="order-list-title" className="font-[family-name:var(--font-heading)] text-base font-semibold tabular-nums" style={{ color: INK }}>
          {vnInt.format(data.total)} đơn hàng{active > 0 ? " khớp bộ lọc" : ""}
        </h2>
        <p className="text-xs xl:hidden" style={{ color: INK_SOFT }}>
          Sắp xếp: {ORDER_SORT_LABEL[query.sort]}
        </p>
      </div>

      {/* ≥ xl: bảng */}
      <div className="hidden xl:block">
        <DataTable
          caption={caption}
          head={[
            "Mã đơn",
            <SortHeader key="created" basePath={basePath} query={query} column="created" label="Ngày tạo" />,
            "Khách hàng",
            "Tài liệu",
            <SortHeader key="total" basePath={basePath} query={query} column="total" label="Tổng tiền" />,
            "Trạng thái",
            <span key="actions" className="sr-only">
              Thao tác
            </span>,
          ]}
          headAriaSort={[undefined, sortState(query.sort, "created") ?? "none", undefined, undefined, sortState(query.sort, "total") ?? "none", undefined, undefined]}
          headClassName={[undefined, "w-28", undefined, "w-[24%]", "text-right", undefined, "w-14 text-right"]}
        >
          {data.items.map((row) => {
            const props = rowProps(row);
            return (
              <Tr key={row.id}>
                <Td>
                  <Link href={props.detailHref} className={`font-mono text-sm font-semibold whitespace-nowrap hover:underline ${FOCUS}`} style={{ color: PRIMARY }}>
                    {row.code}
                  </Link>
                </Td>
                <Td>
                  <TimeCell date={row.createdAt} />
                </Td>
                <Td>
                  <CustomerCell customer={row.customer} />
                </Td>
                <Td>
                  <ItemsCell items={row.items} />
                </Td>
                <Td className="text-right">
                  <MoneyCell vnd={row.totalVnd} />
                </Td>
                <Td>
                  <StatusCell row={row} />
                </Td>
                <Td className="text-right">
                  <OrderRowActions {...props} />
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </div>

      {/* < xl: thẻ */}
      <ul aria-label={caption} className="grid gap-3 md:grid-cols-2 xl:hidden">
        {data.items.map((row) => {
          const props = rowProps(row);
          return (
            <li key={row.id} className="min-w-0 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={props.detailHref}
                    className={`inline-flex min-h-11 items-center font-mono text-[15px] font-semibold hover:underline ${WRAP_ANY} ${FOCUS}`}
                    style={{ color: PRIMARY }}
                  >
                    {row.code}
                  </Link>
                  <p className="text-xs tabular-nums" style={{ color: INK_SOFT }}>
                    <time dateTime={row.createdAt.toISOString()}>
                      {formatOrderDate(row.createdAt)} · {formatOrderTime(row.createdAt)}
                    </time>
                  </p>
                </div>
                <OrderRowActions {...props} />
              </div>
              <div className="mt-3">
                <CustomerCell customer={row.customer} />
              </div>
              <div className="mt-2 text-sm">
                <ItemsCell items={row.items} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: LINE }}>
                <StatusCell row={row} />
                <MoneyCell vnd={row.totalVnd} />
              </div>
            </li>
          );
        })}
      </ul>

      <LinkPagination
        basePath={basePath}
        query={Object.fromEntries(new URLSearchParams(buildOrderListSearch(query, { page: 1 })))}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        label="Phân trang đơn hàng"
        unit="đơn"
        pageParam="trang"
      />
    </section>
  );
}
