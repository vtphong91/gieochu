import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { AdminUserAuditEntry } from "../../../../../lib/admin-user-detail";
import { Badge } from "../../../_ui/kit";
import { IconClock, IconEye, IconLock, IconMail, IconMonitor, IconShield, IconUnlock } from "../../../_ui/icons";
import { formatAdminDateTime } from "../../../_ui/billing-labels";
import { USER_STATUS_LABEL } from "../../_ui/user-labels";
import { LINE } from "../../../_ui/detail-kit";

/*
 * ADR-073 — "Nhật ký" của người dùng (≤ 50 dòng, mới nhất trước — thứ tự do loader quyết). Server Component thuần, cùng khuôn với
 * `TenantAuditLog` (ADR-072): cột thời gian (≥ sm: 9rem bên trái; < sm: dòng riêng phía trên) + cột nội dung: tiêu đề → người làm →
 * trạng thái cũ → mới → lý do (khoá/mở khoá) → số phiên bị đăng xuất → kết quả gửi email. Nhãn luôn có CHỮ; icon đầu dòng chỉ trang trí.
 * Chuỗi dài (lý do, email) ngắt được — không cuộn ngang ở 375px. Chỉ nhật ký L1 — không có thao tác đơn hàng/khách (§7.9), không có IP/UA.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const numberFormat = new Intl.NumberFormat("vi-VN");

function EntryIcon({ entry }: { entry: AdminUserAuditEntry }) {
  const cls = "h-4 w-4";
  switch (entry.kind) {
    case "USER_LOCKED":
      return <IconLock className={cls} />;
    case "USER_UNLOCKED":
      return <IconUnlock className={cls} />;
    case "USER_SESSIONS_REVOKED":
      return <IconMonitor className={cls} />;
    case "USER_PASSWORD_RESET_REQUIRED":
      return <IconShield className={cls} />;
    case "USER_PHONE_VIEWED":
      return <IconEye className={cls} />;
    case "USER_VERIFICATION_RESENT":
      return <IconMail className={cls} />;
    default:
      return entry.action.startsWith("AUTH_") ? <IconShield className={cls} /> : <IconClock className={cls} />;
  }
}

function Dot() {
  return <span aria-hidden="true"> · </span>;
}

function ActorLine({ entry }: { entry: AdminUserAuditEntry }) {
  const { actor } = entry;
  if (actor.role === "SYSTEM") return <p style={{ color: INK_SOFT }}>Hệ thống tự động</p>;
  if (actor.role === "SELF") return <p style={{ color: INK_SOFT }}>Chính người dùng</p>;
  const label = actor.name ?? actor.email;
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
      Quản trị viên
    </p>
  );
}

function StatusLine({ entry }: { entry: AdminUserAuditEntry }) {
  if (!entry.statusChange) return null;
  const labels: Record<string, string> = USER_STATUS_LABEL;
  return (
    <p style={{ color: INK_SOFT }}>
      <span className="sr-only">Trạng thái tài khoản: </span>
      {labels[entry.statusChange.from] ?? entry.statusChange.from}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> chuyển sang </span>
      <span className="font-medium" style={{ color: INK }}>
        {labels[entry.statusChange.to] ?? entry.statusChange.to}
      </span>
    </p>
  );
}

/** Khối trích dẫn (lý do): viền trái + nền xám nhạt, giữ xuống dòng của người nhập, ngắt được chuỗi dài. */
function Quote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-1 rounded-lg border-l-4 bg-gray-50 px-3 py-2 whitespace-pre-line [overflow-wrap:anywhere]" style={{ borderColor: LINE, color: INK }}>
      <span className="font-semibold">{label}: </span>
      {children}
    </p>
  );
}

function ReasonBlock({ entry }: { entry: AdminUserAuditEntry }) {
  if (entry.kind !== "USER_LOCKED" && entry.kind !== "USER_UNLOCKED") return null;
  const label = entry.kind === "USER_LOCKED" ? "Lý do khoá" : "Lý do mở khoá";
  if (entry.reason) return <Quote label={label}>{entry.reason}</Quote>;
  return (
    <p className="text-xs italic" style={{ color: INK_SOFT }}>
      Không có lý do được ghi lại.
    </p>
  );
}

/** "Đã đăng xuất N phiên" + kết quả gửi email — chữ rõ nghĩa, không chỉ màu. */
function OutcomeLine({ entry }: { entry: AdminUserAuditEntry }) {
  const hasSessions = entry.sessionsRevoked !== null;
  if (!hasSessions && entry.emailSent === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: INK_SOFT }}>
      {hasSessions ? <span className="tabular-nums">Đã đăng xuất {numberFormat.format(entry.sessionsRevoked ?? 0)} phiên đăng nhập</span> : null}
      {hasSessions && entry.emailSent !== null ? <span aria-hidden="true">·</span> : null}
      {entry.emailSent === true ? <span>Đã gửi email cho người dùng</span> : null}
      {entry.emailSent === false ? <Badge tone="warning">Chưa gửi được email cho người dùng</Badge> : null}
    </p>
  );
}

function EntryRow({ entry }: { entry: AdminUserAuditEntry }) {
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
        </div>
        <ActorLine entry={entry} />
        <StatusLine entry={entry} />
        <OutcomeLine entry={entry} />
        <ReasonBlock entry={entry} />
      </div>
    </li>
  );
}

export function UserAuditLog({ entries, total }: { entries: AdminUserAuditEntry[]; total: number }) {
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
