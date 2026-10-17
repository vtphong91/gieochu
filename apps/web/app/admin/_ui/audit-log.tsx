import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS, type AuditJsonValue, type AuditScopeValue } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import {
  AUDIT_PAGE_SIZES,
  type AuditActorKind,
  type AuditLogAppliedFilters,
  type AuditLogListResult,
  type AuditLogRowView,
} from "../../../lib/audit-query";
import { Badge, DataTable, EmptyState, Notice, SelectField, Td, TextField, Tr } from "./kit";
import { LinkPagination } from "./link-pagination";
import {
  IconAlertTriangle,
  IconBolt,
  IconChevronDown,
  IconEye,
  IconShield,
  IconStore,
  IconUsers,
  IconXCircle,
} from "./icons";

/**
 * ADR-037 (M12a) — mảnh trình bày dùng chung cho 2 trang xem nhật ký: System Center `/admin/audit` và Studio
 * `/studio/{slug}/activity`. Server Component thuần (không hook, không JS phía client): form lọc GET, bảng (từ `xl`)
 * / danh sách thẻ (dưới `xl`, không cuộn ngang ở 360px), chi tiết `metadata` trong `<details>` dạng key–value.
 * Dữ liệu đã được loader (`lib/audit-query.ts`) che/lọc theo quyền — file này chỉ hiển thị, không tự quyết quyền.
 */

const INK = brandColors.ink;
const INK_SOFT = "#6B7280"; // 4.8:1 trên nền trắng
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
/** Chuỗi dài không dấu cách (email, id, User-Agent) xuống dòng thay vì đẩy tràn ngang. */
const WRAP_ANY = "min-w-0 [overflow-wrap:anywhere]";

const BTN = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition lg:min-h-10 ${FOCUS}`;

// ───────────────────────── Định dạng ─────────────────────────

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

function formatDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" };
  return { date: dateFormat.format(d), time: timeFormat.format(d) };
}

function shortId(id: string): string {
  return id.length > 12 ? `…${id.slice(-8)}` : id;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  Coupon: "Mã giảm giá",
  Entitlement: "Quyền tải",
  Order: "Đơn hàng",
  Plan: "Gói dịch vụ",
  PlatformPaymentConfig: "Cấu hình thanh toán hệ thống",
  Product: "Tài liệu",
  Report: "Báo cáo vi phạm",
  Review: "Đánh giá",
  ShareLink: "Link chia sẻ",
  SubscriptionInvoice: "Hoá đơn gói dịch vụ",
  SystemSettings: "Cấu hình hệ thống",
  Tenant: "Gian hàng",
  TenantPaymentConfig: "Cấu hình thanh toán",
  User: "Người dùng",
};

/**
 * Nhãn tiếng Việt cho khoá `metadata` hay gặp (đối chiếu nơi gọi `audit.log` 2026-10-16). Khoá chưa có nhãn hiện
 * nguyên tên (chữ mono) — thêm action/khoá mới không làm vỡ trang.
 */
const METADATA_KEY_LABELS: Record<string, string> = {
  accountChanged: "Đổi tài khoản nhận tiền",
  alreadyRevoked: "Đã thu hồi từ trước",
  amountVnd: "Số tiền",
  changedFields: "Trường đã đổi",
  changedKeys: "Mục đã đổi",
  changes: "Thay đổi",
  code: "Mã",
  couponCode: "Mã giảm giá",
  couponId: "ID mã giảm giá",
  created: "Tạo mới",
  credentialsChanged: "Đổi thông tin xác thực",
  expiresAt: "Hết hạn",
  extra: "Lượt tải cấp thêm",
  fileCount: "Số tệp",
  form: "Biểu mẫu",
  fulfilled: "Đã cấp quyền tải",
  hiddenReviewProducts: "Số tài liệu ẩn đánh giá",
  isActive: "Đang hoạt động",
  isEnabled: "Đang bật",
  isFree: "Miễn phí",
  maxUses: "Số lượt tối đa",
  orderItemId: "ID dòng đơn",
  periodEnd: "Hết kỳ",
  planId: "ID gói",
  previousPlanId: "ID gói trước",
  previousStatus: "Trạng thái trước",
  priceVnd: "Giá",
  productId: "ID tài liệu",
  protectedLink: "Có mật khẩu",
  provider: "Cổng thanh toán",
  reactivated: "Kích hoạt lại",
  reason: "Lý do",
  requestedEnabled: "Yêu cầu bật",
  revokedEntitlements: "Số quyền tải bị thu hồi",
  revokedSessions: "Số phiên bị thu hồi",
  slug: "Đường dẫn",
  source: "Nguồn",
  truncated: "Đã rút gọn",
  verified: "Đã xác minh",
  wasEnabled: "Trước đó đang bật",
};

const MONEY_KEY = /vnd$|amount|price/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function isPlainObject(value: AuditJsonValue): value is { [key: string]: AuditJsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatScalar(value: AuditJsonValue, key: string): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return MONEY_KEY.test(key) ? `${numberFormat.format(value)} ₫` : numberFormat.format(value);
  if (typeof value === "string") {
    if (value === "[REDACTED]") return "(đã ẩn)";
    if (value === "[TRUNCATED]") return "(đã rút gọn)";
    if (ISO_DATE.test(value)) {
      const { date, time } = formatDateTimeParts(value);
      return time ? `${date} ${time}` : date;
    }
    return value === "" ? "(trống)" : value;
  }
  return "";
}

/** Giá trị metadata → nội dung dễ đọc; object lồng → danh sách con (tối đa 3 tầng rồi mới rơi về chuỗi JSON gọn). */
function MetadataValue({ value, keyName, depth }: { value: AuditJsonValue; keyName: string; depth: number }): ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((v) => !isPlainObject(v) && !Array.isArray(v))) return value.map((v) => formatScalar(v, keyName)).join(", ");
    return depth >= 3 ? JSON.stringify(value) : (
      <ul className="space-y-1">
        {value.map((v, i) => (
          <li key={i}>
            <MetadataValue value={v} keyName={keyName} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    // Cặp cũ → mới (đổi giá, đổi slug, đổi cấu hình): một dòng "a → b".
    if (keys.length === 2 && "from" in value && "to" in value && !isPlainObject(value.from) && !isPlainObject(value.to)) {
      return (
        <>
          {formatScalar(value.from, keyName)} <span aria-hidden="true">→</span>
          <span className="sr-only">thành</span> {formatScalar(value.to, keyName)}
        </>
      );
    }
    if (keys.length === 0) return "—";
    return depth >= 3 ? JSON.stringify(value) : <MetadataList data={value} depth={depth + 1} />;
  }
  return formatScalar(value, keyName);
}

function MetadataList({ data, depth = 0 }: { data: { [key: string]: AuditJsonValue }; depth?: number }) {
  return (
    <dl className={`grid gap-x-3 gap-y-1.5 ${depth > 0 ? "mt-1 border-l-2 pl-3" : ""}`} style={depth > 0 ? { borderColor: LINE } : undefined}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs" style={{ color: INK_SOFT }}>
            {METADATA_KEY_LABELS[key] ?? <span className="font-mono">{key}</span>}
          </dt>
          <dd className={`text-sm ${WRAP_ANY}`} style={{ color: INK }}>
            <MetadataValue value={value} keyName={key} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function hasMetadata(value: AuditJsonValue): boolean {
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

// ───────────────────────── Mảnh hiển thị 1 dòng ─────────────────────────

const SCOPE_TONE: Record<AuditScopeValue, "info" | "success" | "warning"> = {
  SYSTEM: "info",
  TENANT: "success",
  CUSTOMER: "warning",
};

/** Hành động nên để ý (bảo mật/vượt giới hạn) — thêm icon cảnh báo kèm chữ ẩn, không chỉ dựa vào màu. */
const ATTENTION_ACTIONS: ReadonlySet<string> = new Set(["AUTH_LOGIN_FAILED", "AUTH_REFRESH_REUSE", "COUPON_OVERUSED", "USER_LOCKED", "TENANT_LOCKED"]);

const ACTOR_KIND: Record<AuditActorKind, { text: string; Icon: (p: { className?: string }) => ReactNode }> = {
  SYSTEM: { text: "Tác vụ tự động", Icon: IconBolt },
  ADMIN: { text: "Quản trị hệ thống", Icon: IconShield },
  MEMBER: { text: "Thành viên gian hàng", Icon: IconStore },
  USER: { text: "Người dùng", Icon: IconUsers },
  CUSTOMER: { text: "Khách hàng", Icon: IconUsers },
  DELETED: { text: "Tài khoản đã xoá", Icon: IconXCircle },
};

function TimeCell({ iso }: { iso: string }) {
  const { date, time } = formatDateTimeParts(iso);
  return (
    <time dateTime={iso} className="block tabular-nums">
      <span className="block" style={{ color: INK }}>
        {date}
      </span>
      <span className="block text-xs" style={{ color: INK_SOFT }}>
        {time}
      </span>
    </time>
  );
}

function ActionCell({ row }: { row: AuditLogRowView }) {
  const attention = ATTENTION_ACTIONS.has(row.action);
  return (
    <div className="min-w-0">
      <p className="flex items-start gap-1.5 font-semibold" style={{ color: INK }}>
        {attention ? (
          <>
            <span className="mt-0.5 shrink-0" style={{ color: "#B45309" }}>
              <IconAlertTriangle className="h-4 w-4" />
            </span>
            <span className="sr-only">Cần chú ý: </span>
          </>
        ) : null}
        <span className={WRAP_ANY}>{row.actionLabel}</span>
      </p>
      <div className="mt-1">
        <Badge tone={SCOPE_TONE[row.scope]}>
          <span className="sr-only">Phạm vi: </span>
          {row.scopeLabel}
        </Badge>
      </div>
    </div>
  );
}

function ActorCell({ actor }: { actor: AuditLogRowView["actor"] }) {
  const kind = ACTOR_KIND[actor.kind];
  const showKind = kind.text !== actor.label;
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: actor.kind === "DELETED" ? "#F3F4F6" : brandColors.surface, color: actor.kind === "DELETED" ? "#4B5563" : brandColors.primary }}
      >
        <kind.Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`font-medium ${WRAP_ANY}`} style={{ color: INK }}>
          {actor.label}
        </p>
        {actor.name ? (
          <p className={`text-xs ${WRAP_ANY}`} style={{ color: INK }}>
            {actor.name}
          </p>
        ) : null}
        {showKind ? (
          <p className="text-xs" style={{ color: INK_SOFT }}>
            {kind.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TenantCell({ tenant }: { tenant: AuditLogRowView["tenant"] }) {
  if (!tenant) return <span style={{ color: INK_SOFT }}>—</span>;
  if (!tenant.slug) {
    return (
      <div className="min-w-0">
        <p style={{ color: INK }}>Gian hàng đã xoá</p>
        <p className="font-mono text-xs" style={{ color: INK_SOFT }}>
          {shortId(tenant.id)}
        </p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className={`font-medium ${WRAP_ANY}`} style={{ color: INK }}>
        {tenant.name}
      </p>
      <p className={`text-xs ${WRAP_ANY}`} style={{ color: INK_SOFT }}>
        /{tenant.slug}
      </p>
    </div>
  );
}

function TargetCell({ row }: { row: AuditLogRowView }) {
  if (!row.targetType && !row.targetId) return <span style={{ color: INK_SOFT }}>—</span>;
  return (
    <div className="min-w-0">
      {row.targetType ? (
        <p className={WRAP_ANY} style={{ color: INK }}>
          {TARGET_TYPE_LABELS[row.targetType] ?? row.targetType}
        </p>
      ) : null}
      {row.targetId ? (
        <p className="font-mono text-xs" style={{ color: INK_SOFT }}>
          <span className="sr-only">Mã rút gọn: </span>
          {shortId(row.targetId)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Chi tiết 1 dòng trong `<details>` (không JS): metadata key–value + thông tin kỹ thuật (mã đầy đủ, IP, thiết bị).
 * Không có gì để xem → "—".
 */
function DetailsCell({ row, admin }: { row: AuditLogRowView; admin: boolean }) {
  const meta = hasMetadata(row.metadata);
  const tech: { label: string; value: string; mono?: boolean }[] = [];
  if (row.targetId) tech.push({ label: "Mã đối tượng", value: row.targetId, mono: true });
  if (admin && row.actor.id) tech.push({ label: "Mã người thực hiện", value: row.actor.id, mono: true });
  if (row.tenant && admin) tech.push({ label: "Mã gian hàng", value: row.tenant.id, mono: true });
  if (row.ip) tech.push({ label: "Địa chỉ IP", value: row.ip, mono: true });
  if (row.userAgent) tech.push({ label: "Trình duyệt / thiết bị", value: row.userAgent });

  if (!meta && tech.length === 0) return <span style={{ color: INK_SOFT }}>—</span>;

  return (
    <details className="group min-w-0">
      <summary
        className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 text-sm font-semibold lg:min-h-9 [&::-webkit-details-marker]:hidden ${FOCUS}`}
        style={{ color: brandColors.primary }}
      >
        <IconChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        <span className="group-open:hidden">Xem chi tiết</span>
        <span className="hidden group-open:inline">Ẩn chi tiết</span>
      </summary>
      <div className="mt-2 space-y-3 rounded-xl border p-3" style={{ borderColor: LINE, background: "#F9FAFB" }}>
        {meta ? (
          isPlainObject(row.metadata) ? (
            <MetadataList data={row.metadata} />
          ) : (
            <p className={`text-sm ${WRAP_ANY}`} style={{ color: INK }}>
              <MetadataValue value={row.metadata} keyName="" depth={0} />
            </p>
          )
        ) : null}
        {tech.length > 0 ? (
          <div className={meta ? "border-t pt-3" : undefined} style={meta ? { borderColor: LINE } : undefined}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: INK_SOFT }}>
              Thông tin kỹ thuật
            </p>
            <dl className="mt-1.5 grid gap-y-1.5">
              {tech.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-xs" style={{ color: INK_SOFT }}>
                    {item.label}
                  </dt>
                  <dd className={`${item.mono ? "font-mono text-xs" : "text-xs"} ${WRAP_ANY}`} style={{ color: INK }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </details>
  );
}

// ───────────────────────── Danh sách (bảng + thẻ) ─────────────────────────

/**
 * Từ `xl` (≥1280px, vùng làm việc ~930px sau sidebar): bảng `DataTable` có `<caption>`. Dưới `xl`: danh sách thẻ
 * `<ol>` — mỗi thẻ là 1 dòng nhật ký, nhãn trường hiển thị rõ. Hai bản dựng dùng `hidden` (display:none) nên trình
 * đọc màn hình chỉ gặp một bản.
 */
function AuditLogList({ rows, showTenant, caption }: { rows: AuditLogRowView[]; showTenant: boolean; caption: string }) {
  const head = ["Thời gian", "Hành động", "Người thực hiện", ...(showTenant ? ["Gian hàng"] : []), "Đối tượng", "Chi tiết"];
  return (
    <>
      <div className="hidden xl:block">
        <DataTable head={head} caption={caption}>
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="w-28 whitespace-nowrap">
                <TimeCell iso={row.createdAt} />
              </Td>
              <Td>
                <ActionCell row={row} />
              </Td>
              <Td>
                <ActorCell actor={row.actor} />
              </Td>
              {showTenant ? (
                <Td>
                  <TenantCell tenant={row.tenant} />
                </Td>
              ) : null}
              <Td>
                <TargetCell row={row} />
              </Td>
              <Td className="w-56">
                <DetailsCell row={row} admin={showTenant} />
              </Td>
            </Tr>
          ))}
        </DataTable>
      </div>

      <ol aria-label={caption} className="space-y-3 xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <ActionCell row={row} />
              <div className="shrink-0 text-sm sm:text-right">
                <TimeCell iso={row.createdAt} />
              </div>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="mb-1 text-xs font-medium" style={{ color: INK_SOFT }}>
                  Người thực hiện
                </dt>
                <dd>
                  <ActorCell actor={row.actor} />
                </dd>
              </div>
              {showTenant ? (
                <div className="min-w-0">
                  <dt className="mb-1 text-xs font-medium" style={{ color: INK_SOFT }}>
                    Gian hàng
                  </dt>
                  <dd>
                    <TenantCell tenant={row.tenant} />
                  </dd>
                </div>
              ) : null}
              <div className="min-w-0">
                <dt className="mb-1 text-xs font-medium" style={{ color: INK_SOFT }}>
                  Đối tượng
                </dt>
                <dd>
                  <TargetCell row={row} />
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t pt-2" style={{ borderColor: LINE }}>
              <DetailsCell row={row} admin={showTenant} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

// ───────────────────────── Form lọc ─────────────────────────

/** Số điều kiện lọc đang bật (không tính trang/số dòng). */
function countActiveAuditFilters(filters: AuditLogAppliedFilters): number {
  return [filters.actor, filters.action, filters.tenant, filters.from, filters.to].filter(Boolean).length;
}

/** Tham số giữ lại khi chuyển trang (bộ lọc đã chuẩn hoá + pageSize). */
function auditFilterQuery(filters: AuditLogAppliedFilters): Record<string, string | number> {
  return {
    actor: filters.actor,
    action: filters.action,
    tenant: filters.tenant,
    from: filters.from,
    to: filters.to,
    pageSize: filters.pageSize,
  };
}

/**
 * Form GET lọc nhật ký. Gửi form luôn về trang 1 (không có ô `page`). `scope="admin"` có thêm ô người thực hiện +
 * gian hàng; Studio chỉ có hành động, khoảng ngày, số dòng/trang.
 */
export function AuditFilterForm({
  basePath,
  filters,
  scope,
}: {
  basePath: string;
  filters: AuditLogAppliedFilters;
  scope: "admin" | "studio";
}) {
  const admin = scope === "admin";
  const active = countActiveAuditFilters(filters);
  return (
    <form
      method="get"
      action={basePath}
      role="search"
      aria-labelledby="audit-filter-title"
      className="mt-6 rounded-2xl border bg-white p-4 sm:p-5"
      style={{ borderColor: LINE }}
    >
      <h2 id="audit-filter-title" className="font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
        Bộ lọc
      </h2>
      <div className={`mt-3 grid gap-4 sm:grid-cols-2 ${admin ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {admin ? (
          <TextField id="audit-actor" name="actor" label="Người thực hiện" hint="Email hoặc ID người dùng" defaultValue={filters.actor} autoComplete="off" />
        ) : null}
        <SelectField id="audit-action" name="action" label="Hành động" defaultValue={filters.action}>
          <option value="">Tất cả hành động</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {AUDIT_ACTION_LABELS[action]}
            </option>
          ))}
        </SelectField>
        {admin ? (
          <TextField id="audit-tenant" name="tenant" label="Gian hàng" hint="Đường dẫn (slug) hoặc ID" defaultValue={filters.tenant} autoComplete="off" />
        ) : null}
        <TextField id="audit-from" name="from" type="date" label="Từ ngày" defaultValue={filters.from} max={filters.to || undefined} />
        <TextField id="audit-to" name="to" type="date" label="Đến ngày" defaultValue={filters.to} min={filters.from || undefined} />
        <SelectField id="audit-page-size" name="pageSize" label="Số dòng mỗi trang" defaultValue={String(filters.pageSize)}>
          {AUDIT_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} dòng
            </option>
          ))}
        </SelectField>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs" style={{ color: INK_SOFT }}>
          Ngày tính theo giờ Việt Nam. {active > 0 ? `Đang áp dụng ${active} điều kiện lọc.` : "Chưa áp dụng điều kiện lọc nào."}
        </p>
        <div className="flex gap-2">
          <Link href={basePath} className={`${BTN} flex-1 border bg-white hover:bg-gray-50 sm:flex-none`} style={{ borderColor: LINE, color: INK }}>
            Xoá lọc
          </Link>
          <button type="submit" className={`${BTN} flex-1 text-white hover:brightness-110 sm:flex-none`} style={{ background: brandColors.primary }}>
            Lọc
          </button>
        </div>
      </div>
    </form>
  );
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
      {children}
    </Link>
  );
}

function firstPageHref(basePath: string, filters: AuditLogAppliedFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(auditFilterQuery(filters))) {
    if (value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const WARNING_ICON = <IconAlertTriangle className="h-5 w-5" />;

/**
 * Vùng kết quả đủ trạng thái: chưa sẵn sàng (bảng chưa migrate) · bộ lọc actor/tenant không khớp · trang vượt số
 * trang · rỗng theo bộ lọc · rỗng hoàn toàn · danh sách + phân trang link GET (giữ bộ lọc).
 */
export function AuditLogResults({
  result,
  basePath,
  scope,
  caption,
  emptyDescription,
}: {
  result: AuditLogListResult;
  basePath: string;
  scope: "admin" | "studio";
  caption: string;
  /** Mô tả khi chưa có dòng nào (không lọc). */
  emptyDescription: string;
}) {
  const { filters } = result;
  const active = countActiveAuditFilters(filters);
  const icon = <IconEye className="h-6 w-6" />;

  let body: ReactNode;
  if (result.status === "unavailable") {
    body = (
      <Notice tone="warning" icon={WARNING_ICON}>
        <p className="font-semibold">Nhật ký chưa sẵn sàng</p>
        <p className="mt-0.5">Hệ thống chưa thể hiển thị nhật ký lúc này (cơ sở dữ liệu đang được cập nhật). Vui lòng thử lại sau.</p>
      </Notice>
    );
  } else if (result.rows.length > 0) {
    body = (
      <>
        <AuditLogList rows={result.rows} showTenant={scope === "admin"} caption={caption} />
        <LinkPagination
          basePath={basePath}
          query={auditFilterQuery(filters)}
          page={filters.page}
          pageSize={filters.pageSize}
          total={result.total}
          label="Phân trang nhật ký"
        />
      </>
    );
  } else {
    body = (
      <div className="space-y-4">
        {result.unmatchedFilter ? (
          <Notice tone="warning" icon={WARNING_ICON}>
            {result.unmatchedFilter === "actor" ? (
              <>
                Không tìm thấy người dùng nào có email hoặc ID “<span className={`font-semibold ${WRAP_ANY}`}>{filters.actor}</span>”. Kiểm tra lại
                ô Người thực hiện.
              </>
            ) : (
              <>
                Không tìm thấy gian hàng nào có đường dẫn hoặc ID “<span className={`font-semibold ${WRAP_ANY}`}>{filters.tenant}</span>”. Kiểm
                tra lại ô Gian hàng.
              </>
            )}
          </Notice>
        ) : null}
        {result.total > 0 ? (
          <EmptyState
            icon={icon}
            title="Trang này không còn nhật ký"
            description="Số trang vượt quá số kết quả hiện có."
            action={<GhostLink href={firstPageHref(basePath, filters)}>Về trang đầu</GhostLink>}
          />
        ) : active > 0 ? (
          <EmptyState
            icon={icon}
            title="Không có nhật ký khớp bộ lọc"
            description="Thử nới khoảng ngày, chọn hành động khác hoặc xoá bộ lọc."
            action={<GhostLink href={basePath}>Xoá lọc</GhostLink>}
          />
        ) : (
          <EmptyState icon={icon} title="Chưa có nhật ký nào" description={emptyDescription} />
        )}
      </div>
    );
  }

  return (
    <section className="mt-8" aria-labelledby="audit-results-title">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="audit-results-title" className="font-[family-name:var(--font-heading)] text-base font-semibold" style={{ color: INK }}>
          Kết quả
        </h2>
        {result.status === "ok" ? (
          <p className="text-sm tabular-nums" style={{ color: INK_SOFT }}>
            {numberFormat.format(result.total)} mục{active > 0 ? " khớp bộ lọc" : ""}
          </p>
        ) : null}
      </div>
      {body}
    </section>
  );
}
