import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { AdminTenantAuditEntry } from "../../../../../lib/admin-tenant-detail";
import { Badge } from "../../../_ui/kit";
import { IconCard, IconClock, IconFlag, IconLock, IconReceipt, IconRefresh, IconRoute, IconStore, IconUnlock, IconXCircle } from "../../../_ui/icons";
import { formatVndFull } from "../../../_ui/stats-chart";
import { INVOICE_PROVIDER_LABEL, INVOICE_STATUS_LABEL, formatAdminDateTime } from "../../../_ui/billing-labels";
import { TENANT_STATUS_LABEL } from "../../_ui/tenant-labels";
import { LINE } from "./parts";

/*
 * ADR-072 — "Nhật ký quản trị" của gian hàng (≤ 50 dòng, mới nhất trước — thứ tự do loader quyết). Server Component thuần, theo khuôn
 * `SubscriptionActivityLog` (ADR-071): cột thời gian (≥ sm: 9rem bên trái; < sm: dòng riêng phía trên) + cột nội dung: tiêu đề +
 * badge → người làm → hoá đơn → trạng thái cũ → mới → lý do (khoá/mở khoá) → ghi chú. Nhãn/badge luôn có CHỮ; icon đầu dòng chỉ trang
 * trí. Chuỗi dài (lý do, ghi chú, mã) ngắt được — không cuộn ngang ở 375px. Chỉ nhật ký L1 — không có thao tác đơn hàng/khách (§7.9).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const numberFormat = new Intl.NumberFormat("vi-VN");

const ACTOR_ROLE_LABEL = { ADMIN: "Quản trị viên", OWNER: "Chủ gian hàng", SYSTEM: null } as const;

function EntryIcon({ entry }: { entry: AdminTenantAuditEntry }) {
  const cls = "h-4 w-4";
  switch (entry.kind) {
    case "TENANT_CREATED":
      return <IconStore className={cls} />;
    case "TENANT_LOCKED":
      return <IconLock className={cls} />;
    case "TENANT_UNLOCKED":
      return <IconUnlock className={cls} />;
    case "INVOICE_PAID":
      return <IconCard className={cls} />;
    case "INVOICE_VOIDED":
      return <IconXCircle className={cls} />;
    case "INVOICE_REOPENED":
      return <IconRefresh className={cls} />;
    default:
      if (entry.action.startsWith("CONTENT_MODERATION")) return <IconFlag className={cls} />;
      if (entry.action === "TENANT_SLUG_CHANGED") return <IconRoute className={cls} />;
      if (entry.action.startsWith("SUBSCRIPTION_")) return <IconReceipt className={cls} />;
      return <IconClock className={cls} />;
  }
}

function Dot() {
  return <span aria-hidden="true"> · </span>;
}

function providerText(provider: string): string {
  return (INVOICE_PROVIDER_LABEL as Record<string, string>)[provider] ?? provider;
}

/** Nhãn một trạng thái trong dòng "cũ → mới": gian hàng dùng nhãn gian hàng, hoá đơn dùng nhãn hoá đơn, còn lại giữ nguyên mã. */
function statusText(entry: AdminTenantAuditEntry, status: string): string {
  const isTenant = entry.kind === "TENANT_LOCKED" || entry.kind === "TENANT_UNLOCKED";
  if (isTenant) return (TENANT_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return (INVOICE_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function ActorLine({ entry }: { entry: AdminTenantAuditEntry }) {
  const { actor } = entry;
  if (actor.role === "SYSTEM") return <p style={{ color: INK_SOFT }}>Hệ thống tự động</p>;
  const label = actor.name ?? actor.email;
  const role = ACTOR_ROLE_LABEL[actor.role];
  return (
    <p style={{ color: INK_SOFT }}>
      {label ? (
        <>
          <span className="font-medium [overflow-wrap:anywhere]" style={{ color: INK }}>
            {label}
          </span>
          <Dot />
        </>
      ) : null}
      {role}
    </p>
  );
}

function InvoiceLine({ entry }: { entry: AdminTenantAuditEntry }) {
  if (!entry.invoice) return null;
  return (
    <p className="tabular-nums" style={{ color: INK_SOFT }}>
      <span className="sr-only">Hoá đơn </span>
      <span className="font-mono [overflow-wrap:anywhere]" style={{ color: INK }}>
        {entry.invoice.code}
      </span>
      <Dot />
      {formatVndFull(entry.invoice.amountVnd)}
      <Dot />
      {providerText(entry.invoice.provider)}
    </p>
  );
}

function StatusLine({ entry }: { entry: AdminTenantAuditEntry }) {
  if (!entry.statusChange) return null;
  const isTenant = entry.kind === "TENANT_LOCKED" || entry.kind === "TENANT_UNLOCKED";
  const subject = isTenant ? "gian hàng" : entry.invoice ? "hoá đơn" : "";
  return (
    <p style={{ color: INK_SOFT }}>
      <span className="sr-only">{`Trạng thái${subject ? ` ${subject}` : ""}: `}</span>
      {statusText(entry, entry.statusChange.from)}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> chuyển sang </span>
      <span className="font-medium" style={{ color: INK }}>
        {statusText(entry, entry.statusChange.to)}
      </span>
    </p>
  );
}

/** Khối trích dẫn (lý do/ghi chú): viền trái + nền xám nhạt, giữ xuống dòng của người nhập, ngắt được chuỗi dài. */
function Quote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-1 rounded-lg border-l-4 bg-gray-50 px-3 py-2 whitespace-pre-line [overflow-wrap:anywhere]" style={{ borderColor: LINE, color: INK }}>
      <span className="font-semibold">{label}: </span>
      {children}
    </p>
  );
}

function ReasonBlock({ entry }: { entry: AdminTenantAuditEntry }) {
  if (entry.kind !== "TENANT_LOCKED" && entry.kind !== "TENANT_UNLOCKED") return null;
  const label = entry.kind === "TENANT_LOCKED" ? "Lý do khoá" : "Lý do mở khoá";
  if (entry.reason) return <Quote label={label}>{entry.reason}</Quote>;
  return (
    <p className="text-xs italic" style={{ color: INK_SOFT }}>
      Không có lý do được ghi lại.
    </p>
  );
}

function EntryRow({ entry }: { entry: AdminTenantAuditEntry }) {
  return (
    <li className="flex flex-col gap-1.5 py-4 sm:flex-row sm:gap-6">
      <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums sm:w-36 sm:pt-0.5" style={{ color: INK_SOFT }}>
        {formatAdminDateTime(entry.createdAt)}
      </time>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: brandColors.surface, color: brandColors.primary }}>
            <EntryIcon entry={entry} />
          </span>
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
            {entry.actionLabel}
          </p>
          {entry.source === "ABUSE_REPORT" ? <Badge tone="info">Từ báo cáo vi phạm</Badge> : null}
        </div>
        <ActorLine entry={entry} />
        <InvoiceLine entry={entry} />
        <StatusLine entry={entry} />
        <ReasonBlock entry={entry} />
        {entry.note ? <Quote label="Ghi chú">{entry.note}</Quote> : null}
      </div>
    </li>
  );
}

export function TenantAuditLog({ entries, total }: { entries: AdminTenantAuditEntry[]; total: number }) {
  return (
    <>
      <ol className="divide-y divide-gray-100 rounded-2xl border bg-white px-5 sm:px-6" style={{ borderColor: LINE }}>
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ol>
      <p className="mt-3 text-xs text-gray-600 tabular-nums">
        Hiển thị {numberFormat.format(entries.length)} / {numberFormat.format(total)} dòng mới nhất.
      </p>
    </>
  );
}
