"use client";

import { startTransition, useActionState, useState, useTransition, type FormEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import { SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX } from "@gieochu/core/subscription-refund";
import { approveRefundAction, rejectRefundAction, revealRefundPayoutAction, type RefundDecisionActionState, type RevealPayoutResult } from "./actions";
import { FormBanner } from "../../_ui/kit";
import { IconEye, IconEyeOff } from "../../_ui/icons";

/**
 * ADR-041 B — thao tác admin trên một yêu cầu hoàn tiền gói. Chỉ lớp trình bày; action/quyền ở `./actions.ts`.
 * - "Xem đầy đủ" giải mã thông tin nhận tiền theo yêu cầu (audit chỉ ghi id), "Ẩn" xoá khỏi state.
 * - "Đã hoàn tiền" / "Từ chối" là hai bước: bấm nút → mở khung xác nhận (progressive disclosure, thay `window.confirm`),
 *   "Từ chối" bắt buộc lý do. Ô chữ là controlled + gửi bằng `startTransition` (không qua prop `action`) nên lỗi không xoá
 *   nội dung đã gõ.
 */

const INK = brandColors.ink;
const INK_SOFT = "#4B5563";
const LINE = "#E5E7EB";
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9 ${FOCUS}`;
const TEXTAREA =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15";

const initialState: RefundDecisionActionState = {};

/** Thông tin nhận tiền: bản che sẵn từ server + nút "Xem đầy đủ" / "Ẩn". */
export function RevealPayout({ requestId, bankName, accountNoMasked }: { requestId: string; bankName: string; accountNoMasked: string }) {
  const [result, setResult] = useState<RevealPayoutResult | null>(null);
  const [isPending, startReveal] = useTransition();
  const shown = result?.ok ? result.payout : null;

  return (
    <div className="space-y-1.5 text-sm">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt style={{ color: INK_SOFT }}>Ngân hàng</dt>
        <dd className="font-medium [overflow-wrap:anywhere]">{shown?.bankName ?? bankName}</dd>
        <dt style={{ color: INK_SOFT }}>Số tài khoản</dt>
        <dd className="font-mono font-semibold tracking-wide [overflow-wrap:anywhere]">{shown?.accountNo ?? accountNoMasked}</dd>
        {shown ? (
          <>
            <dt style={{ color: INK_SOFT }}>Chủ tài khoản</dt>
            <dd className="font-semibold [overflow-wrap:anywhere]">{shown.accountName}</dd>
          </>
        ) : null}
      </dl>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={shown ? true : false}
        onClick={() => (shown ? setResult(null) : startReveal(async () => setResult(await revealRefundPayoutAction(requestId))))}
        className={`${BTN} border bg-white px-3 hover:bg-gray-50`}
        style={{ borderColor: LINE, color: INK }}
      >
        {shown ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
        {isPending ? "Đang mở..." : shown ? "Ẩn thông tin" : "Xem đầy đủ"}
      </button>
      {shown ? (
        <p className="text-xs" style={{ color: INK_SOFT }}>
          Lần xem đã được ghi nhật ký. Thông tin tự xoá khi yêu cầu được xử lý.
        </p>
      ) : null}
      {result && !result.ok ? (
        <p role="alert" className="text-sm" style={{ color: RED }}>
          {result.error}
        </p>
      ) : null}
    </div>
  );
}

type Mode = "approve" | "reject" | null;

/** "Đã hoàn tiền" (chỉ khi `canApprove`) + "Từ chối" (lý do bắt buộc). */
export function RefundDecision({ requestId, amountLabel, canApprove }: { requestId: string; amountLabel: string; canApprove: boolean }) {
  const [approveState, approveAction, approving] = useActionState(approveRefundAction.bind(null, requestId), initialState);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectRefundAction.bind(null, requestId), initialState);
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const busy = approving || rejecting;
  const panelId = `refund-panel-${requestId}`;
  const reasonMissing = reason.trim().length === 0;

  if (approveState.success) return <FormBanner ok message="Đã đánh dấu hoàn tiền — gian hàng đã về gói Miễn phí và chủ gian hàng nhận email." />;
  if (rejectState.success) return <FormBanner ok message="Đã từ chối yêu cầu — chủ gian hàng nhận email kèm lý do." />;

  function submitApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("adminNote", note);
    startTransition(() => approveAction(formData));
  }

  function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReasonTouched(true);
    if (reasonMissing) {
      document.getElementById(`reject-reason-${requestId}`)?.focus();
      return;
    }
    const formData = new FormData();
    formData.set("reason", reason);
    startTransition(() => rejectAction(formData));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <button
            type="button"
            aria-expanded={mode === "approve"}
            aria-controls={panelId}
            onClick={() => setMode(mode === "approve" ? null : "approve")}
            disabled={busy}
            className={`${BTN} text-white hover:brightness-110`}
            style={{ background: brandColors.primary }}
          >
            Đã hoàn tiền…
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={mode === "reject"}
          aria-controls={panelId}
          onClick={() => setMode(mode === "reject" ? null : "reject")}
          disabled={busy}
          className={`${BTN} border bg-white hover:bg-red-50`}
          style={{ borderColor: "#FCA5A5", color: RED }}
        >
          Từ chối…
        </button>
      </div>

      <div id={panelId}>
        {mode === "approve" && canApprove ? (
          <form onSubmit={submitApprove} className="space-y-3 rounded-xl border p-4" style={{ borderColor: LINE, background: "#F9FAFB" }}>
            <p className="text-sm leading-relaxed" style={{ color: INK }}>
              Xác nhận bạn <strong>đã chuyển khoản {amountLabel}</strong> tới tài khoản ở trên. Hoá đơn sẽ chuyển “Đã hoàn tiền”, gian hàng về gói Miễn phí ngay —
              không hoàn tác được.
            </p>
            <div>
              <label htmlFor={`approve-note-${requestId}`} className="block text-sm font-medium" style={{ color: INK }}>
                Ghi chú gửi chủ gian hàng (không bắt buộc)
              </label>
              <textarea
                id={`approve-note-${requestId}`}
                rows={2}
                value={note}
                maxLength={SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                aria-describedby={`approve-note-${requestId}-hint`}
                className={TEXTAREA}
                style={{ borderColor: LINE }}
              />
              <p id={`approve-note-${requestId}-hint`} className="mt-1 text-xs" style={{ color: INK_SOFT }}>
                Ví dụ mã giao dịch chuyển khoản. {note.length}/{SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX} ký tự.
              </p>
            </div>
            <FormBanner ok={false} message={approveState.error} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={`${BTN} text-white hover:brightness-110`} style={{ background: brandColors.primary }}>
                {approving ? "Đang lưu..." : "Xác nhận đã hoàn tiền"}
              </button>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
                Huỷ
              </button>
            </div>
          </form>
        ) : null}

        {mode === "reject" ? (
          <form onSubmit={submitReject} noValidate className="space-y-3 rounded-xl border p-4" style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}>
            <div>
              <label htmlFor={`reject-reason-${requestId}`} className="block text-sm font-medium" style={{ color: INK }}>
                Lý do từ chối (bắt buộc — gửi cho chủ gian hàng)
              </label>
              <textarea
                id={`reject-reason-${requestId}`}
                rows={3}
                required
                value={reason}
                maxLength={SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setReasonTouched(true)}
                aria-invalid={reasonTouched && reasonMissing ? true : undefined}
                aria-describedby={`reject-reason-${requestId}-${reasonTouched && reasonMissing ? "error" : "hint"}`}
                className={TEXTAREA}
                style={{ borderColor: reasonTouched && reasonMissing ? RED : LINE }}
              />
              {reasonTouched && reasonMissing ? (
                <p id={`reject-reason-${requestId}-error`} role="alert" className="mt-1 text-sm" style={{ color: RED }}>
                  Vui lòng nhập lý do từ chối.
                </p>
              ) : (
                <p id={`reject-reason-${requestId}-hint`} className="mt-1 text-xs" style={{ color: INK_SOFT }}>
                  {reason.length}/{SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX} ký tự. Gói hiện tại của gian hàng không thay đổi; thông tin nhận tiền bị xoá.
                </p>
              )}
            </div>
            <FormBanner ok={false} message={rejectState.error} />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={`${BTN} text-white hover:brightness-110`} style={{ background: RED }}>
                {rejecting ? "Đang lưu..." : "Xác nhận từ chối"}
              </button>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: LINE, color: INK }}>
                Huỷ
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
