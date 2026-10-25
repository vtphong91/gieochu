"use client";

import { useActionState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { confirmManualInvoiceAction, type ConfirmInvoiceActionState } from "./actions";

const initialState: ConfirmInvoiceActionState = {};

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
