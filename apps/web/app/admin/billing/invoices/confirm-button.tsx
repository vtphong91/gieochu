"use client";

import { useActionState, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import {
  confirmInvoiceFromTransactionAction,
  confirmManualInvoiceAction,
  type ConfirmFromTransactionActionState,
  type ConfirmInvoiceActionState,
} from "./actions";

const initialState: ConfirmInvoiceActionState = {};
const initialTxnState: ConfirmFromTransactionActionState = {};

/** Nút "Xác nhận đã nhận tiền" cho hoá đơn MANUAL_QR PENDING. Cao 44px dưới lg; lỗi đọc qua `role="alert"`. */
export function ConfirmButton({ invoiceId, invoiceCode }: { invoiceId: string; invoiceCode: string }) {
  const action = confirmManualInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <button
        type="submit"
        disabled={isPending}
        aria-label={`Xác nhận đã nhận tiền cho hoá đơn ${invoiceCode}`}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-8"
        style={{ background: brandColors.primary }}
      >
        {isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-1 max-w-56 text-right text-xs text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * ADR-059 bổ sung — xác nhận tay hoá đơn MANUAL_QR đã HẾT HẠN (tiền về trễ). Hai bước: bấm nút → khung xác nhận nêu rõ hoá đơn
 * đã hết hạn và kỳ gói tính lại từ lúc xác nhận; server chặn nếu gian hàng đã có hoá đơn mới hơn.
 */
export function ExpiredConfirmButton({ invoiceId, invoiceCode, amountLabel }: { invoiceId: string; invoiceCode: string; amountLabel: string }) {
  const action = confirmManualInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const panelId = `expired-confirm-${invoiceId}`;

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        disabled={isPending}
        aria-label={`Xác nhận đã nhận tiền cho hoá đơn đã hết hạn ${invoiceCode}`}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold whitespace-nowrap transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-8"
        style={{ borderColor: brandColors.primary, color: brandColors.primary }}
      >
        Xác nhận trễ…
      </button>
      <div id={panelId}>
        {open ? (
          <form action={formAction} className="mt-2 max-w-72 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-xs leading-relaxed text-gray-800">
            <p>
              Hoá đơn <strong>{invoiceCode}</strong> <strong>đã hết hạn</strong>. Chỉ xác nhận khi sao kê đã nhận đủ <strong>{amountLabel}</strong> với nội dung là
              mã hoá đơn.
            </p>
            <p>Kỳ gói sẽ được tính lại từ thời điểm xác nhận (không dùng kỳ cũ của hoá đơn). Không hoàn tác được.</p>
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
