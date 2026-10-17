import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import {
  ABUSE_REPORT_DECISION_LABELS,
  ABUSE_REPORT_STATUS_LABELS,
  ABUSE_REPORT_STATUSES,
  ABUSE_REPORT_TYPE_LABELS,
  ABUSE_REPORT_TYPES,
  ABUSE_TARGET_TYPE_LABELS,
  ABUSE_TARGET_TYPES,
  type AbuseReportStatusValue,
} from "@gieochu/core/abuse-report";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { AbuseReportListFilters, AbuseReportListItem, AbuseReportListResult } from "../../../../lib/abuse-report";
import { Badge, DataTable, EmptyState, Notice, SelectField, Td, Tr } from "../../_ui/kit";
import { IconAlertTriangle, IconChevronRight, IconFlag } from "../../_ui/icons";
import { LinkPagination } from "../../_ui/link-pagination";

/*
 * ADR-038 mục 5 — mảnh trình bày trang `/admin/reports` (Server Component thuần, không JS phía client), theo mẫu trang
 * nhật ký M12a (`admin/_ui/audit-log.tsx`): form lọc GET · bảng từ `xl` / danh sách thẻ dưới `xl` (không cuộn ngang ở
 * 360px) · phân trang link GET giữ bộ lọc. Dữ liệu do loader `listAbuseReports` (tự kiểm SYSTEM_ADMIN) trả về.
 * Email người báo cáo chỉ hiển thị ở System Center (ADR-038 mục 4).
 */

const INK = brandColors.ink;
const INK_SOFT = "#6B7280"; // 4.8:1 trên nền trắng
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const WRAP_ANY = "min-w-0 [overflow-wrap:anywhere]";
const BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition lg:min-h-10 ${FOCUS}`;

export const REPORT_PAGE_SIZES = [10, 20, 50, 100] as const;

export const REPORT_STATUS_TONE: Record<AbuseReportStatusValue, "warning" | "success" | "neutral"> = {
  OPEN: "warning",
  RESOLVED: "success",
  REJECTED: "neutral",
};

export const TENANT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Hoạt động",
  READ_ONLY: "Tạm ngưng bán",
  LOCKED: "Đã khoá",
};

export const TENANT_STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  READ_ONLY: "warning",
  LOCKED: "danger",
};

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const numberFormat = new Intl.NumberFormat("vi-VN");

/** Bộ lọc mặc định = chỉ báo cáo chờ xử lý (status OPEN, không type/targetType). */
function countActiveFilters(filters: AbuseReportListFilters): number {
  return [filters.status !== "OPEN" ? "status" : "", filters.type, filters.targetType].filter(Boolean).length;
}

/** Tham số giữ lại khi chuyển trang. `status` null = "Tất cả" → gửi `ALL` để không rơi về mặc định OPEN. */
function filterQuery(filters: AbuseReportListFilters, pageSize: number): Record<string, string | number> {
  return {
    status: filters.status === "OPEN" ? "" : (filters.status ?? "ALL"),
    type: filters.type ?? "",
    targetType: filters.targetType ?? "",
    pageSize: pageSize === 20 ? "" : pageSize,
  };
}

function hrefWith(basePath: string, query: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== "") params.set(key, String(value));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// ───────────────────────── Form lọc ─────────────────────────

export function ReportFilterForm({ basePath, filters, pageSize }: { basePath: string; filters: AbuseReportListFilters; pageSize: number }) {
  const active = countActiveFilters(filters);
  return (
    <form
      method="get"
      action={basePath}
      role="search"
      aria-labelledby="report-filter-title"
      className="mt-6 rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: LINE }}
    >
      <h2 id="report-filter-title" className="font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
        Bộ lọc
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SelectField id="report-status" name="status" label="Trạng thái" defaultValue={filters.status ?? "ALL"}>
          {ABUSE_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ABUSE_REPORT_STATUS_LABELS[s]}
            </option>
          ))}
          <option value="ALL">Tất cả trạng thái</option>
        </SelectField>
        <SelectField id="report-type" name="type" label="Loại vi phạm" defaultValue={filters.type ?? ""}>
          <option value="">Tất cả loại</option>
          {ABUSE_REPORT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ABUSE_REPORT_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <SelectField id="report-target" name="targetType" label="Đối tượng" defaultValue={filters.targetType ?? ""}>
          <option value="">Tất cả đối tượng</option>
          {ABUSE_TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ABUSE_TARGET_TYPE_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <SelectField id="report-page-size" name="pageSize" label="Số dòng mỗi trang" defaultValue={String(pageSize)}>
          {REPORT_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} dòng
            </option>
          ))}
        </SelectField>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs" style={{ color: INK_SOFT }}>
          Mặc định chỉ hiện báo cáo chờ xử lý. {active > 0 ? `Đang áp dụng ${active} điều kiện lọc.` : "Chưa áp dụng điều kiện lọc nào khác."}
        </p>
        <div className="flex gap-2">
          <Link href={basePath} className={`${BTN} flex-1 border bg-white hover:bg-gray-50 sm:flex-none`} style={{ borderColor: LINE, color: INK }}>
            Xoá lọc
          </Link>
          <button type="submit" className={`${BTN} flex-1 cursor-pointer text-white hover:brightness-110 sm:flex-none`} style={{ background: brandColors.primary }}>
            Lọc
          </button>
        </div>
      </div>
    </form>
  );
}

// ───────────────────────── Ô hiển thị ─────────────────────────

function TimeCell({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} className="block tabular-nums">
      <span className="block" style={{ color: INK }}>
        {dateFormat.format(date)}
      </span>
      <span className="block text-xs" style={{ color: INK_SOFT }}>
        {timeFormat.format(date)}
      </span>
    </time>
  );
}

function StatusCell({ item }: { item: AbuseReportListItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap">
      <Badge tone={REPORT_STATUS_TONE[item.status]}>{ABUSE_REPORT_STATUS_LABELS[item.status]}</Badge>
      {item.decision && item.decision !== "REJECT" ? (
        <span className="text-xs font-medium" style={{ color: INK }}>
          {ABUSE_REPORT_DECISION_LABELS[item.decision]}
        </span>
      ) : null}
    </div>
  );
}

function TargetCell({ item }: { item: AbuseReportListItem }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium" style={{ color: INK_SOFT }}>
        {ABUSE_TARGET_TYPE_LABELS[item.targetType]}
      </p>
      {item.targetTitle ? (
        <p className={`font-medium ${WRAP_ANY}`} style={{ color: INK }}>
          {item.targetTitle}
        </p>
      ) : (
        <p className="italic" style={{ color: INK_SOFT }}>
          Nội dung đã bị xoá
        </p>
      )}
    </div>
  );
}

function TenantCell({ tenant }: { tenant: AbuseReportListItem["tenant"] }) {
  if (!tenant) return <span style={{ color: INK_SOFT }}>—</span>;
  return (
    <div className="min-w-0">
      <p className={`font-medium ${WRAP_ANY}`} style={{ color: INK }}>
        {tenant.name}
      </p>
      <p className={`text-xs ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
        /{tenant.slug}
      </p>
      {tenant.status !== "ACTIVE" ? (
        <div className="mt-1 whitespace-nowrap">
          <Badge tone={TENANT_STATUS_TONE[tenant.status] ?? "neutral"}>{TENANT_STATUS_LABEL[tenant.status] ?? tenant.status}</Badge>
        </div>
      ) : null}
    </div>
  );
}

function ReporterCell({ item }: { item: AbuseReportListItem }) {
  return (
    <div className="min-w-0">
      <p className={`text-sm ${WRAP_ANY}`} style={{ color: INK }}>
        {item.reporterEmail}
      </p>
      <p className="text-xs" style={{ color: INK_SOFT }}>
        {item.isGuest ? "Khách (chưa đăng nhập)" : "Thành viên"}
      </p>
    </div>
  );
}

function detailLabel(item: AbuseReportListItem): string {
  return `${ABUSE_REPORT_TYPE_LABELS[item.type]} — ${ABUSE_TARGET_TYPE_LABELS[item.targetType].toLowerCase()} ${item.targetTitle ?? "đã bị xoá"}`;
}

function DetailLink({ item, block = false }: { item: AbuseReportListItem; block?: boolean }) {
  const open = item.status === "OPEN";
  return (
    <Link
      href={`/admin/reports/${item.id}`}
      className={`${BTN} whitespace-nowrap ${block ? "w-full sm:w-auto" : "px-3"} ${open ? "text-white hover:brightness-110" : "border bg-white hover:bg-gray-50"}`}
      style={open ? { background: brandColors.primary } : { borderColor: LINE, color: INK }}
    >
      {open ? "Xử lý" : "Xem"}
      <span className="sr-only"> báo cáo {detailLabel(item)}</span>
      <IconChevronRight className="h-4 w-4" />
    </Link>
  );
}

// ───────────────────────── Danh sách ─────────────────────────

function ReportList({ items, caption }: { items: AbuseReportListItem[]; caption: string }) {
  return (
    <>
      <div className="hidden xl:block">
        <DataTable head={["Thời gian", "Báo cáo", "Gian hàng", "Người báo cáo", "Trạng thái", ""]} headClassName={[undefined, undefined, undefined, undefined, undefined, "text-right"]} caption={caption}>
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="w-28 whitespace-nowrap">
                <TimeCell date={item.createdAt} />
              </Td>
              <Td>
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: INK }}>
                  <IconFlag className="h-4 w-4 shrink-0" />
                  {ABUSE_REPORT_TYPE_LABELS[item.type]}
                </p>
                <TargetCell item={item} />
                {item.descriptionExcerpt ? (
                  <p className={`mt-1 line-clamp-2 text-xs ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
                    <span className="sr-only">Mô tả: </span>
                    {item.descriptionExcerpt}
                  </p>
                ) : null}
              </Td>
              <Td>
                <TenantCell tenant={item.tenant} />
              </Td>
              <Td className="max-w-52">
                <ReporterCell item={item} />
              </Td>
              <Td>
                <StatusCell item={item} />
              </Td>
              <Td className="text-right">
                <DetailLink item={item} />
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      <ol aria-label={caption} className="space-y-3 xl:hidden">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold" style={{ color: INK }}>
                  <IconFlag className="h-4 w-4 shrink-0" />
                  {ABUSE_REPORT_TYPE_LABELS[item.type]}
                </p>
                <div className="mt-1.5">
                  <StatusCell item={item} />
                </div>
              </div>
              <div className="shrink-0 text-sm sm:text-right">
                <TimeCell date={item.createdAt} />
              </div>
            </div>
            <div className="mt-3">
              <TargetCell item={item} />
              {item.descriptionExcerpt ? (
                <p className={`mt-1 line-clamp-3 text-sm ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
                  <span className="sr-only">Mô tả: </span>
                  {item.descriptionExcerpt}
                </p>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="mb-1 text-xs font-medium" style={{ color: INK_SOFT }}>
                  Gian hàng
                </dt>
                <dd>
                  <TenantCell tenant={item.tenant} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="mb-1 text-xs font-medium" style={{ color: INK_SOFT }}>
                  Người báo cáo
                </dt>
                <dd>
                  <ReporterCell item={item} />
                </dd>
              </div>
            </dl>
            <div className="mt-4 border-t pt-3" style={{ borderColor: LINE }}>
              <DetailLink item={item} block />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

const WARNING_ICON = <IconAlertTriangle className="h-5 w-5" />;

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
      {children}
    </Link>
  );
}

/** Vùng kết quả đủ trạng thái: chưa sẵn sàng · danh sách + phân trang · trang vượt số trang · rỗng theo lọc · không còn báo cáo chờ. */
export function ReportResults({ result, basePath, page, pageSize }: { result: AbuseReportListResult; basePath: string; page: number; pageSize: number }) {
  const { filters } = result;
  const active = countActiveFilters(filters);
  const query = filterQuery(filters, pageSize);
  const icon = <IconFlag className="h-6 w-6" />;

  let body: ReactNode;
  if (result.status === "unavailable") {
    body = (
      <Notice tone="warning" icon={WARNING_ICON}>
        <p className="font-semibold">Báo cáo vi phạm chưa sẵn sàng</p>
        <p className="mt-0.5">Hệ thống chưa thể hiển thị báo cáo lúc này (cơ sở dữ liệu đang được cập nhật). Vui lòng thử lại sau.</p>
      </Notice>
    );
  } else if (result.items.length > 0) {
    body = (
      <>
        <ReportList items={result.items} caption="Báo cáo vi phạm, mới nhất trước" />
        <LinkPagination basePath={basePath} query={query} page={page} pageSize={pageSize} total={result.total} label="Phân trang báo cáo vi phạm" unit="báo cáo" />
      </>
    );
  } else if (result.total > 0) {
    body = (
      <EmptyState
        icon={icon}
        title="Trang này không còn báo cáo"
        description="Số trang vượt quá số kết quả hiện có."
        action={<GhostLink href={hrefWith(basePath, query)}>Về trang đầu</GhostLink>}
      />
    );
  } else if (active > 0) {
    body = (
      <EmptyState
        icon={icon}
        title="Không có báo cáo khớp bộ lọc"
        description="Thử chọn trạng thái hoặc loại khác, hoặc xoá bộ lọc."
        action={<GhostLink href={basePath}>Xoá lọc</GhostLink>}
      />
    );
  } else {
    body = (
      <EmptyState
        icon={icon}
        title="Không có báo cáo nào chờ xử lý"
        description="Báo cáo mới từ người dùng sẽ xuất hiện ở đây."
        action={<GhostLink href={`${basePath}?status=ALL`}>Xem mọi báo cáo</GhostLink>}
      />
    );
  }

  return (
    <section className="mt-8" aria-labelledby="report-results-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="report-results-title" className="font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
          Kết quả
        </h2>
        {result.status === "ok" ? (
          <p className="text-sm tabular-nums" style={{ color: INK_SOFT }}>
            {numberFormat.format(result.total)} báo cáo
            {filters.status ? ` · ${ABUSE_REPORT_STATUS_LABELS[filters.status].toLowerCase()}` : ""}
          </p>
        ) : null}
      </div>
      {body}
    </section>
  );
}
