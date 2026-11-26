import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import type {
  AdminSubscriptionActivityEntry,
  SubscriptionActivityKind,
  SubscriptionEmailKind,
  SubscriptionPaymentSource,
} from "../../../../../lib/subscription-billing";
import { Badge } from "../../../_ui/kit";
import { IconAlertTriangle, IconCard, IconClock, IconMail, IconReceipt, IconRefresh, IconXCircle } from "../../../_ui/icons";
import { formatVndFull } from "../../../_ui/stats-chart";
import { INVOICE_PROVIDER_LABEL, INVOICE_STATUS_LABEL, formatAdminDateTime } from "../../../_ui/billing-labels";

/*
 * ADR-071 (2A) — một dòng "Nhật ký thao tác" của trang Chi tiết đơn hàng gói. Server Component thuần (không state).
 * Bố cục: cột thời gian (≥ sm: 9rem bên trái; < sm: dòng riêng phía trên) + cột nội dung: tiêu đề + nhãn nguồn → người làm →
 * mã · số tiền · cổng → đã nhận/chênh → trạng thái cũ → mới → khối giao dịch ngân hàng → ghi chú. Nhãn/badge luôn có CHỮ (không
 * truyền nghĩa chỉ bằng màu); icon đầu dòng chỉ trang trí. Chuỗi dài (mã, nội dung CK, ghi chú) ngắt được — không cuộn ngang ở 375px.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = "#E5E7EB";
/** amber-800 — chữ chênh lệch tiền (≥ 4.5:1 trên nền trắng); kèm chữ "thừa/thiếu" nên không phụ thuộc màu. */
const AMBER_TEXT = "#92400E";
const RED_TEXT = "#B91C1C";

const PAYMENT_SOURCE_LABEL: Record<SubscriptionPaymentSource, string> = {
  AUTO_SEPAY: "Tự động qua SePay",
  AUTO_MOMO: "Tự động qua MoMo",
  AUTO_OTHER: "Tự động qua cổng thanh toán",
  ADMIN_MANUAL: "Quản trị viên xác nhận tay",
  ADMIN_FROM_TRANSACTION: "Quản trị viên xác nhận từ giao dịch",
};

const EMAIL_KIND_LABEL: Record<SubscriptionEmailKind, string> = {
  INVOICE_PAID: "Thanh toán thành công",
  INVOICE_EXPIRED: "Hết hạn thanh toán",
  INVOICE_AMOUNT_MISMATCH: "Số tiền không khớp",
  INVOICE_PAYMENT_FAILED: "Thanh toán chưa thành công",
  INVOICE_VOIDED: "Huỷ hoá đơn",
};

const KIND_TITLE: Partial<Record<SubscriptionActivityKind, string>> = {
  INVOICE_CREATED: "Tạo hoá đơn gói dịch vụ",
  PAYMENT: "Thanh toán hoá đơn gói",
  INVOICE_VOIDED: "Huỷ hoá đơn gói",
  INVOICE_REOPENED: "Mở lại hoá đơn gói",
};

const ACTOR_ROLE_LABEL: Record<"SYSTEM_ADMIN" | "TENANT_OWNER" | "OTHER", string | null> = {
  SYSTEM_ADMIN: "Quản trị viên",
  TENANT_OWNER: "Chủ gian hàng",
  OTHER: null,
};

function KindIcon({ kind }: { kind: SubscriptionActivityKind }) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "INVOICE_CREATED":
      return <IconReceipt className={cls} />;
    case "PAYMENT":
      return <IconCard className={cls} />;
    case "INVOICE_VOIDED":
      return <IconXCircle className={cls} />;
    case "INVOICE_REOPENED":
      return <IconRefresh className={cls} />;
    case "EMAIL":
      return <IconMail className={cls} />;
    default:
      return <IconClock className={cls} />;
  }
}

/** Nhãn trạng thái hoá đơn (giá trị lạ → giữ nguyên mã). */
function invoiceStatusText(status: string): string {
  return (INVOICE_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function providerText(provider: string): string {
  return (INVOICE_PROVIDER_LABEL as Record<string, string>)[provider] ?? provider;
}

function Dot() {
  return <span aria-hidden="true"> · </span>;
}

function Title({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  if (entry.kind === "EMAIL" && entry.email) {
    const name = EMAIL_KIND_LABEL[entry.email.kind] ?? entry.actionLabel;
    const to = entry.email.recipientIsCurrentOwner ? "tới chủ gian hàng" : entry.email.recipientMasked ? `tới ${entry.email.recipientMasked}` : null;
    return entry.email.status === "FAILED" ? (
      <>
        Gửi email “{name}”{to ? ` ${to}` : ""} không thành công
      </>
    ) : (
      <>
        Đã gửi email “{name}”{to ? ` ${to}` : ""}
      </>
    );
  }
  return <>{KIND_TITLE[entry.kind] ?? entry.actionLabel}</>;
}

function ActorLine({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  if (entry.inferred) {
    return (
      <p className="italic" style={{ color: INK_SOFT }}>
        Không rõ người tạo
      </p>
    );
  }
  if (!entry.actor) return <p style={{ color: INK_SOFT }}>Tự động</p>;
  const role = ACTOR_ROLE_LABEL[entry.actor.role];
  return (
    <p style={{ color: INK_SOFT }}>
      <span className="font-medium [overflow-wrap:anywhere]" style={{ color: INK }}>
        {entry.actor.label}
      </span>
      {role ? (
        <>
          <Dot />
          {role}
        </>
      ) : null}
    </p>
  );
}

function InvoiceLine({ entry }: { entry: AdminSubscriptionActivityEntry }) {
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
      {entry.kind === "INVOICE_CREATED" && entry.planName ? (
        <>
          <Dot />
          gói {entry.planName}
        </>
      ) : null}
    </p>
  );
}

function ReceivedLine({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  if (entry.receivedVnd === null || entry.differenceVnd === null || entry.differenceVnd === 0) return null;
  const over = entry.differenceVnd > 0;
  return (
    <p className="font-medium tabular-nums" style={{ color: AMBER_TEXT }}>
      Đã nhận {formatVndFull(entry.receivedVnd)}
      <Dot />
      {over ? "thừa" : "thiếu"} {formatVndFull(Math.abs(entry.differenceVnd))}
    </p>
  );
}

function StatusLine({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  if (!entry.fromStatus && !entry.toStatus) return null;
  return (
    <p style={{ color: INK_SOFT }}>
      <span className="sr-only">Trạng thái hoá đơn: </span>
      {entry.fromStatus ? invoiceStatusText(entry.fromStatus) : "—"}
      <span aria-hidden="true"> → </span>
      <span className="sr-only"> chuyển sang </span>
      <span className="font-medium" style={{ color: INK }}>
        {entry.toStatus ? invoiceStatusText(entry.toStatus) : "—"}
      </span>
    </p>
  );
}

function BankTransactions({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  const txns = entry.bankTransactions;
  if (txns.length === 0) return null;
  return (
    <div className="mt-1 max-w-xl space-y-2">
      {txns.length > 1 ? (
        <p className="flex items-start gap-1.5 text-xs font-medium" style={{ color: RED_TEXT }}>
          <IconAlertTriangle className="mt-px h-4 w-4 shrink-0" />
          Nhiều giao dịch khớp cùng hoá đơn — kiểm tra trả trùng.
        </p>
      ) : null}
      {txns.map((txn, index) => (
        <div key={`${txn.reference ?? "txn"}-${index}`} className="rounded-lg border bg-gray-50 px-3 py-2.5 text-xs" style={{ borderColor: LINE }}>
          <p className="mb-1.5 font-semibold" style={{ color: INK }}>
            Giao dịch {txns.length > 1 ? `${index + 1}/${txns.length} ` : ""}
            {providerText(txn.provider)}
          </p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt style={{ color: INK_SOFT }}>Mã giao dịch</dt>
            <dd className="font-mono [overflow-wrap:anywhere]" style={{ color: INK }}>
              {txn.reference ? `#${txn.reference}` : "Không có"}
            </dd>
            <dt style={{ color: INK_SOFT }}>Thời điểm</dt>
            <dd className="tabular-nums" style={{ color: INK }}>
              {txn.occurredAt ? <time dateTime={txn.occurredAt.toISOString()}>{formatAdminDateTime(txn.occurredAt)}</time> : "Không rõ"}
            </dd>
            <dt style={{ color: INK_SOFT }}>Số tiền</dt>
            <dd className="font-semibold tabular-nums" style={{ color: INK }}>
              {formatVndFull(txn.amountVnd)}
            </dd>
            <dt style={{ color: INK_SOFT }}>Nội dung</dt>
            <dd className="font-mono [overflow-wrap:anywhere]" style={{ color: INK }}>
              {txn.contentExcerpt ? `“${txn.contentExcerpt}”` : "Không có"}
            </dd>
          </dl>
        </div>
      ))}
    </div>
  );
}

function ActivityRow({ entry }: { entry: AdminSubscriptionActivityEntry }) {
  const failedEmail = entry.kind === "EMAIL" && entry.email?.status === "FAILED";
  return (
    <li className="flex flex-col gap-1.5 py-4 sm:flex-row sm:gap-6">
      <time dateTime={entry.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums sm:w-36 sm:pt-0.5" style={{ color: INK_SOFT }}>
        {formatAdminDateTime(entry.createdAt)}
      </time>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: brandColors.surface, color: brandColors.primary }}>
            <KindIcon kind={entry.kind} />
          </span>
          <p className="min-w-0 font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
            <Title entry={entry} />
          </p>
          {entry.paymentSource ? <Badge tone={entry.paymentSource.startsWith("AUTO_") ? "info" : "neutral"}>{PAYMENT_SOURCE_LABEL[entry.paymentSource]}</Badge> : null}
          {entry.lateConfirmation ? <Badge tone="warning">Xác nhận trễ</Badge> : null}
          {failedEmail ? <Badge tone="danger">Gửi thất bại</Badge> : null}
        </div>
        <ActorLine entry={entry} />
        <InvoiceLine entry={entry} />
        {entry.kind === "EMAIL" && entry.email && !entry.email.recipientIsCurrentOwner ? (
          <p className="text-xs" style={{ color: INK_SOFT }}>
            Người nhận không phải email chủ gian hàng hiện tại.
          </p>
        ) : null}
        <ReceivedLine entry={entry} />
        <StatusLine entry={entry} />
        <BankTransactions entry={entry} />
        {entry.note ? (
          <p className="mt-1 rounded-lg border-l-4 bg-gray-50 px-3 py-2 whitespace-pre-line [overflow-wrap:anywhere]" style={{ borderColor: LINE, color: INK }}>
            <span className="sr-only">Ghi chú: </span>
            {entry.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** Danh sách nhật ký (mới nhất trước — thứ tự do loader quyết). Trống → nơi gọi hiện `EmptyState`. */
export function SubscriptionActivityLog({ entries }: { entries: AdminSubscriptionActivityEntry[] }): ReactNode {
  return (
    <ol className="divide-y divide-gray-100 rounded-2xl border bg-white px-5 sm:px-6" style={{ borderColor: LINE }}>
      {entries.map((entry) => (
        <ActivityRow key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}
