"use client";

import { useActionState, useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, Notice, PrimaryButton } from "../../_ui/kit";
import {
  confirmInvoiceFromTransactionAction,
  confirmManualInvoiceAction,
  type ConfirmFromTransactionActionState,
  type ConfirmInvoiceActionState,
} from "./actions";

const initialState: ConfirmInvoiceActionState = {};
const initialTxnState: ConfirmFromTransactionActionState = {};

/**
 * ADR-066 — "Xác nhận đã nhận tiền" cho hoá đơn gói đang chờ hoặc đã hết hạn, MỌI cổng (dùng ở /admin/billing/invoices và cột
 * "Thao tác" của /admin/subscriptions). Hai bước: bấm nút → khung xác nhận nêu hoá đơn, số tiền, cổng; hoá đơn hết hạn nêu thêm kỳ
 * gói tính lại từ lúc xác nhận (server chặn nếu có hoá đơn mới hơn); cổng tự xác nhận (SePay/MoMo) nhắc chỉ dùng khi webhook không
 * tới. Ghi chú không bắt buộc (ghi audit). Vùng bấm 44px dưới lg; lỗi đọc qua `role="alert"`.
 *
 * Khung xác nhận là `<dialog>` mở bằng `showModal()`: top layer (không làm dãn ô/bảng), nền phía sau `inert`, Esc / "Huỷ" /
 * bấm nền mờ để đóng (đang xử lý thì không đóng), focus vào tiêu đề khi mở, đóng xong trả focus về nút mở. Xác nhận thành
 * công → đóng hộp; phản hồi chính là badge "Đã thanh toán" của dòng (action revalidate cả hai trang). Nhãn nút gọn dưới md,
 * ngữ cảnh mã hoá đơn nằm trong `sr-only` (tên truy cập bắt đầu đúng bằng chữ hiển thị).
 */
export function ManualConfirmButton({
  invoiceId,
  invoiceCode,
  amountLabel,
  providerLabel,
  expired,
  autoProvider,
  align = "end",
}: {
  invoiceId: string;
  invoiceCode: string;
  amountLabel: string;
  providerLabel: string;
  /** Hoá đơn đã hết hạn → nhánh xác nhận trễ (tính lại kỳ). */
  expired: boolean;
  /** Cổng tự xác nhận qua webhook (SePay/MoMo). */
  autoProvider: boolean;
  align?: "start" | "end";
}) {
  const action = confirmManualInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const noteId = `${uid}-note`;
  const noteHintId = `${uid}-note-hint`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // State của action lúc mở hộp — lỗi của lần mở trước không hiện lại khi mở lần sau.
  const [openedWith, setOpenedWith] = useState<ConfirmInvoiceActionState | null>(null);
  const error = openedWith !== null && state !== openedWith ? state.error : undefined;

  // Xác nhận thành công → đóng hộp (dòng bảng tự đổi badge sau revalidate).
  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state.success]);

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setOpenedWith(state);
    formRef.current?.reset();
    dialog.showModal();
    // Focus tiêu đề: trình đọc màn hình đọc tên + mô tả hộp trước; không bật bàn phím ảo trên mobile.
    titleRef.current?.focus();
  }

  function closeDialog() {
    if (!isPending) dialogRef.current?.close();
  }

  /** Sự kiện `close` gốc (Esc, "Huỷ", nền mờ, hoặc đóng sau khi thành công) — trả focus về nút mở nếu nút còn. */
  function handleClosed() {
    setOpenedWith(null);
    triggerRef.current?.focus();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc khi đang gửi: giữ hộp mở để người dùng thấy kết quả.
    if (isPending) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDialog();
  }

  return (
    <div className={`inline-flex flex-col ${align === "end" ? "items-end" : "items-start"}`}>
      {state.success ? null : (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={openDialog}
          disabled={isPending}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--color-primary)] bg-white px-3 text-xs font-semibold whitespace-nowrap text-[color:var(--color-primary)] transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none lg:min-h-8"
        >
          {expired ? (
            "Xác nhận trễ…"
          ) : (
            <>
              <span className="md:hidden">Xác nhận…</span>
              <span className="hidden md:inline">Xác nhận đã nhận tiền…</span>
            </>
          )}
          <span className="sr-only">{` hoá đơn ${expired ? "đã hết hạn " : ""}${invoiceCode}`}</span>
        </button>
      )}
      {/* Luôn có trong DOM để trình đọc màn hình nhận thay đổi (khi component còn hiển thị sau lúc xác nhận). */}
      <p role="status" className="text-xs font-medium text-green-700 empty:hidden">
        {state.success ? "Đã xác nhận thanh toán." : ""}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={handleClosed}
        onCancel={handleCancel}
        onClick={handleBackdropClick}
        // Không đặt `flex` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở <form> con.
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        style={{ color: brandColors.ink }}
      >
        <form ref={formRef} action={formAction} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="font-[family-name:var(--font-heading)] text-lg leading-snug font-semibold outline-none"
          >
            {expired ? "Xác nhận trễ hoá đơn đã hết hạn?" : "Xác nhận đã nhận tiền?"}
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
            Chỉ xác nhận khi tài khoản đã nhận đủ <strong className="font-semibold text-gray-900">{amountLabel}</strong> cho hoá đơn{" "}
            <span className="font-mono [overflow-wrap:anywhere]">{invoiceCode}</span>.
          </p>

          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <dt className="text-gray-600">Mã hoá đơn</dt>
            <dd className="font-mono font-semibold select-all [overflow-wrap:anywhere]">{invoiceCode}</dd>
            <dt className="text-gray-600">Số tiền</dt>
            <dd className="font-semibold tabular-nums">{amountLabel}</dd>
            <dt className="text-gray-600">Cổng</dt>
            <dd>{providerLabel}</dd>
            {expired ? (
              <>
                <dt className="text-gray-600">Trạng thái</dt>
                <dd>Đã hết hạn</dd>
              </>
            ) : null}
          </dl>

          <div className="mt-4">
            <Notice tone="warning">
              {autoProvider ? (
                <p className="mb-1.5">Cổng này bình thường tự xác nhận qua webhook — chỉ xác nhận tay khi đã đối chiếu sao kê mà hệ thống chưa ghi nhận.</p>
              ) : null}
              <p>
                {expired ? "Kỳ gói sẽ được tính lại từ thời điểm xác nhận (không dùng kỳ cũ của hoá đơn). " : "Gói được gia hạn theo kỳ của hoá đơn. "}
                <strong className="font-semibold">Không hoàn tác được.</strong>
              </p>
            </Notice>
          </div>

          <label htmlFor={noteId} className="mt-4 block text-sm font-medium">
            Ghi chú <span className="font-normal text-gray-600">(không bắt buộc)</span>
          </label>
          <textarea
            id={noteId}
            name="note"
            rows={3}
            maxLength={500}
            aria-describedby={noteHintId}
            placeholder="VD: mã GD ngân hàng, ngày nhận tiền"
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-base outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/15 motion-reduce:transition-none lg:text-sm"
          />
          <p id={noteHintId} className="mt-1.5 text-xs text-gray-600">
            Lưu vào nhật ký thao tác (tối đa 500 ký tự).
          </p>

          {error ? (
            <div className="mt-3">
              <FormBanner ok={false} message={error} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton disabled={isPending} onClick={closeDialog}>
              Huỷ
            </GhostButton>
            <PrimaryButton loading={isPending}>{isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}</PrimaryButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}

/**
 * ADR-059 bổ sung lần 2 — "Xác nhận hoá đơn từ giao dịch" (tab Giao dịch cổng). Admin nhập/xác nhận rõ mã hoá đơn; khung xác
 * nhận nêu số nhận, chênh lệch (thừa → admin hoàn ngoài hệ thống) và việc hoá đơn hết hạn sẽ tính lại kỳ. Server chặn thiếu tiền,
 * giao dịch đã dùng, hoá đơn mới hơn.
 */
export function TransactionConfirmButton({
  transactionId,
  defaultInvoiceCode,
  receivedLabel,
  hint,
}: {
  transactionId: string;
  defaultInvoiceCode: string;
  receivedLabel: string;
  /** Mô tả chênh lệch / hết hạn cho hoá đơn đã biết (do server tính sẵn). */
  hint: string | null;
}) {
  const action = confirmInvoiceFromTransactionAction.bind(null, transactionId);
  const [state, formAction, isPending] = useActionState(action, initialTxnState);
  const [open, setOpen] = useState(false);
  const panelId = `txn-confirm-${transactionId}`;
  const inputId = `txn-invoice-${transactionId}`;

  if (state.success) {
    return <p className="text-xs font-medium text-green-700">Đã xác nhận hoá đơn từ giao dịch này.</p>;
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="mt-1 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold whitespace-nowrap transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-8"
        style={{ borderColor: brandColors.primary, color: brandColors.primary }}
      >
        Xác nhận hoá đơn…
      </button>
      <div id={panelId}>
        {open ? (
          <form action={formAction} className="mt-2 max-w-72 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs leading-relaxed text-gray-800">
            <label htmlFor={inputId} className="block font-semibold">
              Mã hoá đơn được thanh toán bằng giao dịch {receivedLabel}
            </label>
            <input
              id={inputId}
              name="invoiceCode"
              required
              defaultValue={defaultInvoiceCode}
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 font-mono text-sm uppercase"
            />
            {hint ? <p>{hint}</p> : null}
            <p>Giao dịch thiếu tiền sẽ bị từ chối. Phần thừa (nếu có) bạn tự hoàn cho gian hàng ngoài hệ thống. Không hoàn tác được.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 font-semibold hover:bg-gray-50 disabled:opacity-60 lg:min-h-8"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-3 font-semibold text-white hover:brightness-110 disabled:opacity-60 lg:min-h-8"
                style={{ background: brandColors.primary }}
              >
                {isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
              </button>
            </div>
            {state.error ? (
              <p role="alert" className="text-red-700">
                {state.error}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
