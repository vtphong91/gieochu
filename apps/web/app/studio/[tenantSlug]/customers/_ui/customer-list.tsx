import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import {
  CUSTOMER_DATE_FIELDS,
  CUSTOMER_DEFAULT_DATE_FIELD,
  CUSTOMER_GROUPS,
  CUSTOMER_LIST_DEFAULT_PAGE_SIZE,
  CUSTOMER_LIST_DEFAULT_SORT,
  CUSTOMER_LIST_PAGE_SIZES,
  CUSTOMER_LIST_SORTS,
  buildCustomerListSearch,
  type CustomerListItem,
  type CustomerListPage,
  type CustomerListQuery,
  type CustomerListSort,
  type CustomerListStats,
} from "../../../../../lib/customer-list";
import { Badge, DataTable, EmptyState, Td, Tr } from "../../../../admin/_ui/kit";
import { IconArrowDown, IconGift, IconShoppingBag, IconTag, IconUsers, IconWallet } from "../../../../admin/_ui/icons";
import { LinkPagination } from "../../../../admin/_ui/link-pagination";
import { DashboardDateRangePicker } from "../../../../admin/_ui/date-range-picker";
import { KpiCard, formatCount, formatVndFull } from "../../../../admin/_ui/stats-chart";
import { OrderFilterForm } from "../../orders/_ui/order-filter-form";
import { formatOrderDate, formatOrderTime, hrefWithSearch } from "../../orders/_ui/order-format";
import { CustomerRowActions } from "./customer-row-actions";
import {
  CUSTOMER_DATE_FIELD_LABEL,
  CUSTOMER_GROUP_LABEL,
  CUSTOMER_SORT_LABEL,
  countActiveCustomerFilters,
  customerDisplayName,
  customerOrdersHref,
  formatRate,
  type CustomerNoteAction,
} from "./customer-format";

/*
 * ADR-048 — trang danh sách Khách hàng Studio (Server Component; chỉ ô chọn ngày, form lọc và menu dòng là client).
 * Cùng ngôn ngữ trang Đơn hàng (ADR-046): form GET `OrderFilterForm` (URL gọn), `DashboardDateRangePicker` ở `formMode`,
 * bảng từ `xl` (sidebar Studio chiếm chỗ ở lg) / thẻ dưới `xl` (không cuộn ngang ở 360px), `LinkPagination`.
 * Dữ liệu từ `listCustomersPage` (`lib/customer-list.ts`); URL dựng bằng `buildCustomerListSearch` của loader.
 * Khách: họ tên + email (không SĐT/tỉnh — ADR-041). Tiền đầy đủ (`formatVndFull`, 0 → "0 đ").
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

// ───────────────────────── Thẻ thống kê ─────────────────────────

export function CustomerStatsStrip({ stats }: { stats: CustomerListStats }) {
  const returningPct = formatRate(stats.returningCustomerRate);
  const { range, dateField, newCustomersRange } = stats.scope;
  return (
    <section aria-labelledby="customer-stats-title" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="customer-stats-title" className="font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
          Tổng quan khách hàng
        </h2>
        <p className="text-xs" style={{ color: INK_SOFT }}>
          {range
            ? `Khách có ${CUSTOMER_DATE_FIELD_LABEL[dateField].toLowerCase()} trong ${range.label.toLowerCase()} (theo bộ lọc ngày).`
            : "Toàn bộ khách của gian hàng — không áp ô tìm, nhóm và tài liệu."}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="Tổng khách"
          icon={<IconUsers className="h-5 w-5" />}
          value={formatCount(stats.totalCustomers)}
          detail={`+${formatCount(stats.newCustomers)} khách mới · ${newCustomersRange.label}`}
          note="Khách có ít nhất một đơn đã thanh toán, kể cả đơn nhận miễn phí."
        />
        <KpiCard
          label="Khách quay lại"
          icon={<IconShoppingBag className="h-5 w-5" />}
          iconTone="secondary"
          value={formatCount(stats.returningCustomers)}
          detail={returningPct ? `${returningPct} số khách trả phí` : "Chưa có khách trả phí"}
          note="Khách có từ 2 đơn trả phí trở lên."
        />
        <KpiCard
          label="Tổng chi tiêu"
          icon={<IconWallet className="h-5 w-5" />}
          value={formatVndFull(stats.spentVnd)}
          detail={`Đã hoàn: ${formatVndFull(stats.refundedVnd)}`}
          note="Tổng gộp các đơn trả phí đã thanh toán, tính cả đơn sau này hoàn tiền."
        />
        <KpiCard
          label="Chi tiêu TB / khách trả phí"
          icon={<IconTag className="h-5 w-5" />}
          iconTone="accent"
          value={stats.avgSpentPerPayingCustomer === null ? "—" : formatVndFull(stats.avgSpentPerPayingCustomer)}
          detail={stats.avgSpentPerPayingCustomer === null ? "Chưa có khách trả phí" : `${formatCount(stats.payingCustomers)} khách trả phí`}
          note="Tổng chi tiêu ÷ số khách trả phí."
        />
        <KpiCard
          label="Khách chỉ nhận miễn phí"
          icon={<IconGift className="h-5 w-5" />}
          iconTone="accent"
          value={formatCount(stats.freeOnlyCustomers)}
          note="Chỉ có đơn 0 đ — chưa mua tài liệu trả phí nào."
        />
      </div>
    </section>
  );
}

// ───────────────────────── Thanh lọc ─────────────────────────

export function CustomerFilterBar({
  basePath,
  data,
  today,
}: {
  basePath: string;
  data: Pick<CustomerListPage, "query" | "groupCounts" | "products" | "stats">;
  /** `YYYY-MM-DD` giờ VN (server). */
  today: string;
}) {
  const { query } = data;
  const active = countActiveCustomerFilters(query);
  // `key` theo bộ lọc đã áp dụng: sau "Xoá lọc"/điều hướng, các ô (defaultValue) dựng lại đúng giá trị mới.
  const formKey = buildCustomerListSearch(query, { page: 1 });

  return (
    <OrderFilterForm
      action={basePath}
      label="Lọc khách hàng"
      defaults={{
        nhom: "tat-ca",
        theo: CUSTOMER_DEFAULT_DATE_FIELD,
        "sap-xep": CUSTOMER_LIST_DEFAULT_SORT,
        "so-dong": String(CUSTOMER_LIST_DEFAULT_PAGE_SIZE),
      }}
      className="mt-6 rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: LINE }}
    >
      <div key={formKey} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="customer-q" className={FIELD_LABEL} style={{ color: INK }}>
              Tìm khách hàng
            </label>
            <input
              id="customer-q"
              type="search"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Họ tên hoặc email (gõ không dấu cũng được)"
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="min-w-0">
            <label htmlFor="customer-group" className={FIELD_LABEL} style={{ color: INK }}>
              Nhóm khách
            </label>
            <select
              id="customer-group"
              name="nhom"
              defaultValue={query.group}
              aria-describedby="customer-group-hint"
              className={`${CONTROL} truncate`}
              style={{ color: INK }}
            >
              {CUSTOMER_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {CUSTOMER_GROUP_LABEL[g]} ({formatCount(data.groupCounts[g])})
                </option>
              ))}
            </select>
            <p id="customer-group-hint" className="mt-1 text-xs" style={{ color: INK_SOFT }}>
              Khách mới = mua lần đầu trong {query.range ? "khoảng ngày đang chọn" : data.stats.scope.newCustomersRange.label.toLowerCase()}.
            </p>
          </div>
          <div className="min-w-0">
            <span aria-hidden="true" className={FIELD_LABEL} style={{ color: INK }}>
              Khoảng ngày
            </span>
            <DashboardDateRangePicker
              activeKey={query.range?.key ?? null}
              displayFrom={query.range?.displayFrom ?? today}
              displayTo={query.range?.displayTo ?? today}
              today={today}
              formMode={{ label: "Khoảng ngày mua", dialogTitle: "Chọn khoảng ngày mua", allowAll: true }}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="customer-date-field" className={FIELD_LABEL} style={{ color: INK }}>
              Ngày tính theo
            </label>
            <select id="customer-date-field" name="theo" defaultValue={query.dateField} className={CONTROL} style={{ color: INK }}>
              {CUSTOMER_DATE_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {CUSTOMER_DATE_FIELD_LABEL[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="customer-product" className={FIELD_LABEL} style={{ color: INK }}>
              Đã mua tài liệu
            </label>
            <select id="customer-product" name="san-pham" defaultValue={query.productId ?? ""} className={`${CONTROL} truncate`} style={{ color: INK }}>
              <option value="">Tất cả tài liệu</option>
              {data.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {/* Sắp xếp: dưới xl không có tiêu đề cột → chọn ở đây; từ xl ẩn (đổi bằng tiêu đề cột) nhưng vẫn gửi theo form. */}
            <div className="min-w-0 xl:hidden">
              <label htmlFor="customer-sort" className={FIELD_LABEL} style={{ color: INK }}>
                Sắp xếp
              </label>
              <select id="customer-sort" name="sap-xep" defaultValue={query.sort} className={`${CONTROL} truncate`} style={{ color: INK }}>
                {CUSTOMER_LIST_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {CUSTOMER_SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor="customer-page-size" className={FIELD_LABEL} style={{ color: INK }}>
                Số dòng mỗi trang
              </label>
              <select id="customer-page-size" name="so-dong" defaultValue={String(query.pageSize)} className={CONTROL} style={{ color: INK }}>
                {CUSTOMER_LIST_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} khách
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          {active > 0 ? `Đang áp dụng ${active} điều kiện lọc.` : "Đang xem mọi khách hàng."} Số đơn và chi tiêu là luỹ kế, chỉ tính đơn trả phí
          đã thanh toán; đơn 0 đ ghi riêng là “miễn phí”. Ngày giờ theo giờ Việt Nam.
        </p>
      </div>
    </OrderFilterForm>
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

function CustomerBadges({ row }: { row: CustomerListItem }) {
  if (!row.hasRefundRequest && !row.inactive) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {row.hasRefundRequest ? <Badge tone="warning">Có yêu cầu hoàn tiền</Badge> : null}
      {row.inactive ? <Badge tone="neutral">Lâu chưa quay lại</Badge> : null}
    </div>
  );
}

function CustomerCell({ row }: { row: CustomerListItem }) {
  const hasName = Boolean(row.fullName?.trim());
  const note = row.note?.trim();
  return (
    <div className="min-w-0">
      <p className={`font-semibold ${WRAP_ANY}`} style={{ color: INK }}>
        {customerDisplayName(row)}
      </p>
      {hasName ? (
        <p className={`text-xs ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
          {row.email}
        </p>
      ) : null}
      {note ? (
        // Cắt 1 dòng về mặt hiển thị; trình đọc màn hình vẫn đọc đủ, toàn văn có ở `title` và trong hộp Ghi chú.
        <p className="mt-1 truncate text-xs" style={{ color: INK_SOFT }} title={note}>
          <span className="font-medium" style={{ color: INK }}>
            Ghi chú:
          </span>{" "}
          {note}
        </p>
      ) : null}
      <CustomerBadges row={row} />
    </div>
  );
}

function OrdersCountCell({ row }: { row: CustomerListItem }) {
  return (
    <div className="tabular-nums">
      <span className="font-semibold" style={{ color: INK }}>
        {formatCount(row.paidOrders)}
      </span>
      {row.freeClaims > 0 ? (
        <span className="block text-xs whitespace-nowrap" style={{ color: INK_SOFT }}>
          +{formatCount(row.freeClaims)} miễn phí
        </span>
      ) : null}
    </div>
  );
}

function MoneyCell({ vnd, strong = false }: { vnd: number; strong?: boolean }) {
  return (
    <span className={`tabular-nums xl:whitespace-nowrap ${strong ? "font-semibold" : ""}`} style={{ color: INK }}>
      {formatVndFull(vnd)}
    </span>
  );
}

function RefundedCell({ vnd }: { vnd: number }) {
  if (vnd <= 0)
    return (
      <span style={{ color: INK_SOFT }}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Chưa hoàn</span>
      </span>
    );
  return <MoneyCell vnd={vnd} />;
}

// ───────────────────────── Tiêu đề cột sắp xếp ─────────────────────────

/** Loader chỉ có thứ tự giảm dần (mới nhất / nhiều nhất trước) → mỗi cột là 1 kiểu sắp xếp. */
function SortHeader({ basePath, query, sort, label }: { basePath: string; query: CustomerListQuery; sort: CustomerListSort; label: string }) {
  const current = query.sort === sort;
  const href = hrefWithSearch(basePath, buildCustomerListSearch(query, { sort }));
  return (
    <Link
      href={href}
      scroll={false}
      className={`-mx-1 inline-flex min-h-9 items-center gap-1 rounded px-1 font-medium hover:underline ${FOCUS}`}
      style={{ color: current ? INK : INK_SOFT }}
    >
      {label}
      <IconArrowDown className={`h-3.5 w-3.5 ${current ? "" : "opacity-40"}`} />
      <span className="sr-only">{current ? ", đang sắp xếp giảm dần" : ", bấm để sắp xếp giảm dần"}</span>
    </Link>
  );
}

const ariaSortOf = (query: CustomerListQuery, sort: CustomerListSort) => (query.sort === sort ? "descending" : "none");

// ───────────────────────── Danh sách ─────────────────────────

export function CustomerList({
  basePath,
  tenantSlug,
  data,
  noteAction,
}: {
  basePath: string;
  tenantSlug: string;
  data: CustomerListPage;
  /** Bỏ trống → ẩn mục "Ghi chú" trong menu (chưa có Server Action). */
  noteAction?: CustomerNoteAction;
}) {
  const { query } = data;
  const active = countActiveCustomerFilters(query);

  if (data.items.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          icon={<IconUsers className="h-6 w-6" />}
          title={active > 0 ? "Không có khách hàng phù hợp bộ lọc" : "Chưa có khách hàng nào"}
          description={
            active > 0
              ? "Thử bỏ bớt điều kiện, đổi nhóm khách, khoảng ngày hoặc tìm theo từ khoá khác."
              : "Khách hàng xuất hiện ở đây ngay khi có người thanh toán hoặc nhận tài liệu miễn phí ở cửa hàng của bạn."
          }
          action={
            active > 0 ? (
              <Link href={basePath} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
                Xem tất cả khách hàng
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const caption = `Danh sách khách hàng, ${formatCount(data.total)} khách${active > 0 ? " khớp bộ lọc" : ""}, trang ${data.page}/${data.pageCount}`;
  const actionProps = (row: CustomerListItem) => ({
    userId: row.userId,
    displayName: customerDisplayName(row),
    note: row.note?.trim() ? row.note : null,
    ordersHref: customerOrdersHref(tenantSlug, row.userId),
    noteAction,
  });

  return (
    <section aria-labelledby="customer-list-title" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="customer-list-title" className="font-[family-name:var(--font-heading)] text-base font-semibold tabular-nums" style={{ color: INK }}>
          {formatCount(data.total)} khách hàng{active > 0 ? " khớp bộ lọc" : ""}
        </h2>
        <p className="text-xs xl:hidden" style={{ color: INK_SOFT }}>
          Sắp xếp: {CUSTOMER_SORT_LABEL[query.sort]}
        </p>
      </div>

      {/* ≥ xl: bảng */}
      <div className="hidden xl:block">
        <DataTable
          caption={caption}
          head={[
            "Khách",
            <SortHeader key="orders" basePath={basePath} query={query} sort="so-don-giam" label="Số đơn" />,
            <SortHeader key="spent" basePath={basePath} query={query} sort="chi-tieu-giam" label="Tổng chi tiêu" />,
            "Đã hoàn",
            <SortHeader key="first" basePath={basePath} query={query} sort="moi-nhat" label="Mua lần đầu" />,
            <SortHeader key="last" basePath={basePath} query={query} sort="gan-nhat" label="Mua gần nhất" />,
            <span key="actions" className="sr-only">
              Thao tác
            </span>,
          ]}
          headAriaSort={[
            undefined,
            ariaSortOf(query, "so-don-giam"),
            ariaSortOf(query, "chi-tieu-giam"),
            undefined,
            ariaSortOf(query, "moi-nhat"),
            ariaSortOf(query, "gan-nhat"),
            undefined,
          ]}
          headClassName={["w-[32%]", "w-24", "text-right", "text-right", "w-32", "w-32", "w-14 text-right"]}
        >
          {data.items.map((row) => (
            <Tr key={row.userId}>
              <Td>
                <CustomerCell row={row} />
              </Td>
              <Td>
                <OrdersCountCell row={row} />
              </Td>
              <Td className="text-right">
                <MoneyCell vnd={row.spentVnd} strong />
              </Td>
              <Td className="text-right">
                <RefundedCell vnd={row.refundedVnd} />
              </Td>
              <Td>
                <TimeCell date={row.firstOrderAt} />
              </Td>
              <Td>
                <TimeCell date={row.lastOrderAt} />
              </Td>
              <Td className="text-right">
                <CustomerRowActions {...actionProps(row)} />
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      {/* < xl: thẻ */}
      <ul aria-label={caption} className="grid gap-3 md:grid-cols-2 xl:hidden">
        {data.items.map((row) => (
          <li key={row.userId} className="min-w-0 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            <div className="flex items-start justify-between gap-2">
              <CustomerCell row={row} />
              <CustomerRowActions {...actionProps(row)} />
            </div>
            <dl className="mt-3 grid grid-cols-6 gap-x-3 gap-y-2.5 border-t pt-3 text-sm" style={{ borderColor: LINE }}>
              <div className="col-span-2 min-w-0">
                <dt className="text-xs" style={{ color: INK_SOFT }}>
                  Số đơn
                </dt>
                <dd>
                  <OrdersCountCell row={row} />
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-xs" style={{ color: INK_SOFT }}>
                  Tổng chi tiêu
                </dt>
                <dd className={WRAP_ANY}>
                  <MoneyCell vnd={row.spentVnd} strong />
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-xs" style={{ color: INK_SOFT }}>
                  Đã hoàn
                </dt>
                <dd className={WRAP_ANY}>
                  <RefundedCell vnd={row.refundedVnd} />
                </dd>
              </div>
              <div className="col-span-3 min-w-0">
                <dt className="text-xs" style={{ color: INK_SOFT }}>
                  Mua lần đầu
                </dt>
                <dd>
                  <TimeCell date={row.firstOrderAt} />
                </dd>
              </div>
              <div className="col-span-3 min-w-0">
                <dt className="text-xs" style={{ color: INK_SOFT }}>
                  Mua gần nhất
                </dt>
                <dd>
                  <TimeCell date={row.lastOrderAt} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <LinkPagination
        basePath={basePath}
        query={Object.fromEntries(new URLSearchParams(buildCustomerListSearch(query, { page: 1 })))}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        label="Phân trang khách hàng"
        unit="khách"
        pageParam="trang"
      />
    </section>
  );
}
