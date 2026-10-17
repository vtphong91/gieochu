import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { ENTITLEMENT_REMEDY_STATUS_LABELS, REMEDY_REFUND_SLA_DAYS, type EntitlementRemedyStatusValue } from "@gieochu/core/entitlement-remedy";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { Badge } from "../../../../admin/_ui/kit";
import { IconAlertTriangle, IconReceipt } from "../../../../admin/_ui/icons";

/*
 * ADR-039 — mảnh trình bày "quyền lợi người mua" trong Studio → Đơn hàng (Server Component, không hook). Hạn xử lý
 * yêu cầu hoàn tiền = `remedyChosenAt` + REMEDY_REFUND_SLA_DAYS ngày; quá hạn tô đỏ + chữ "Quá hạn" (không chỉ màu).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

export function formatRemedyDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

export function refundDueAt(chosenAt: Date): Date {
  return new Date(chosenAt.getTime() + REMEDY_REFUND_SLA_DAYS * DAY_MS);
}

/** Yêu cầu hoàn tiền đã quá hạn xử lý (chỉ áp với REFUND_REQUESTED có `remedyChosenAt`). */
export function isRefundOverdue(status: EntitlementRemedyStatusValue, chosenAt: Date | null, now: Date): boolean {
  return status === "REFUND_REQUESTED" && chosenAt !== null && refundDueAt(chosenAt).getTime() < now.getTime();
}

/** Badge đơn hàng: "Khách yêu cầu hoàn tiền" (vàng) / "… · quá hạn" (đỏ) — chữ nói rõ, không chỉ dựa vào màu. */
export function RefundRequestBadge({ overdue }: { overdue: boolean }) {
  return <Badge tone={overdue ? "danger" : "warning"}>{overdue ? "Khách yêu cầu hoàn tiền · quá hạn" : "Khách yêu cầu hoàn tiền"}</Badge>;
}

const REMEDY_TONE: Record<Exclude<EntitlementRemedyStatusValue, "NONE">, "warning" | "info" | "neutral" | "danger"> = {
  PENDING_CHOICE: "warning",
  FINAL_DOWNLOAD: "info",
  REFUND_REQUESTED: "warning",
  REFUNDED: "neutral",
};

function Block({ tone, icon, children }: { tone: "warning" | "danger" | "neutral"; icon: ReactNode; children: ReactNode }) {
  const style =
    tone === "danger"
      ? { borderColor: "#B91C1C", background: "#FEF2F2" }
      : tone === "warning"
        ? { borderColor: brandColors.accent, background: brandColors.accentSoft }
        : { borderColor: "#9CA3AF", background: "#F9FAFB" };
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-l-4 p-3.5 text-sm leading-relaxed" style={{ ...style, color: brandColors.ink }}>
      <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: tone === "danger" ? "#B91C1C" : tone === "warning" ? "#92400E" : "#4B5563" }}>
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Trạng thái quyền lợi người mua của 1 dòng đơn (remedyStatus ≠ NONE). `canMarkRefunded` = nút "Đánh dấu đã hoàn tiền"
 * đang hiện trên trang (đơn FULFILLED) — hướng dẫn trỏ tới nút đó qua `actionsAnchorId`.
 */
export function OrderItemRemedy({
  status,
  chosenAt,
  resolvedAt = null,
  now,
  canMarkRefunded,
  actionsAnchorId,
}: {
  status: Exclude<EntitlementRemedyStatusValue, "NONE">;
  chosenAt: Date | null;
  /** Ngày ghi nhận hoàn tiền (REFUNDED). */
  resolvedAt?: Date | null;
  now: Date;
  canMarkRefunded: boolean;
  actionsAnchorId: string;
}) {
  const label = <Badge tone={REMEDY_TONE[status]}>{ENTITLEMENT_REMEDY_STATUS_LABELS[status]}</Badge>;

  if (status === "REFUND_REQUESTED") {
    const due = chosenAt ? refundDueAt(chosenAt) : null;
    const overdue = isRefundOverdue(status, chosenAt, now);
    const daysLate = due && overdue ? Math.max(1, Math.floor((now.getTime() - due.getTime()) / DAY_MS)) : 0;
    return (
      <Block tone={overdue ? "danger" : "warning"} icon={overdue ? <IconAlertTriangle className="h-5 w-5" /> : <IconReceipt className="h-5 w-5" />}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{overdue ? `Khách yêu cầu hoàn tiền — quá hạn xử lý ${daysLate} ngày` : "Khách yêu cầu hoàn tiền"}</p>
        </div>
        <p className="mt-1">
          Tài liệu bị gỡ do vi phạm chính sách và khách đã chọn hoàn tiền
          {chosenAt ? (
            <>
              {" "}
              lúc <time dateTime={chosenAt.toISOString()}>{formatRemedyDateTime(chosenAt)}</time>
            </>
          ) : null}
          . {due ? (
            <>
              Hạn xử lý ({REMEDY_REFUND_SLA_DAYS} ngày):{" "}
              <strong className="font-semibold">
                <time dateTime={due.toISOString()}>{formatRemedyDateTime(due)}</time>
              </strong>
              .
            </>
          ) : null}
        </p>
        <p className="mt-1">
          Hoàn tiền cho khách qua kênh bạn đã nhận thanh toán, sau đó bấm{" "}
          {canMarkRefunded ? (
            <a href={`#${actionsAnchorId}`} className="font-semibold underline underline-offset-2" style={{ color: brandColors.primary }}>
              “Đánh dấu đã hoàn tiền”
            </a>
          ) : (
            <strong className="font-semibold">“Đánh dấu đã hoàn tiền”</strong>
          )}{" "}
          để ghi nhận. Khách không tải được tài liệu này nữa.
          {overdue ? " Quản trị hệ thống thấy số yêu cầu quá hạn của gian hàng." : ""}
        </p>
      </Block>
    );
  }

  const refundedAt = resolvedAt ?? chosenAt;
  const text: Record<Exclude<typeof status, "REFUND_REQUESTED">, string> = {
    PENDING_CHOICE: "Tài liệu bị gỡ do vi phạm chính sách — khách đang chọn tải lần cuối hoặc yêu cầu hoàn tiền. Tải xuống tạm khoá.",
    FINAL_DOWNLOAD: "Tài liệu bị gỡ do vi phạm chính sách — khách đã chọn tải lần cuối (số lượt bằng số tệp — mỗi lượt tải một tệp).",
    REFUNDED: "Đã ghi nhận hoàn tiền cho yêu cầu của khách. Quyền tải đã thu hồi.",
  };
  return (
    <Block tone={status === "PENDING_CHOICE" ? "warning" : "neutral"} icon={<IconAlertTriangle className="h-5 w-5" />}>
      <div className="flex flex-wrap items-center gap-2">{label}</div>
      <p className="mt-1">
        {text[status]}
        {status === "REFUNDED" && refundedAt ? (
          <>
            {" "}
            Đã hoàn tiền lúc <time dateTime={refundedAt.toISOString()}>{formatRemedyDateTime(refundedAt)}</time>.
          </>
        ) : null}
        {chosenAt && status !== "PENDING_CHOICE" ? (
          <>
            {" "}
            Khách chọn lúc <time dateTime={chosenAt.toISOString()}>{formatRemedyDateTime(chosenAt)}</time>.
          </>
        ) : null}
      </p>
    </Block>
  );
}
