"use client";

import { useActionState, useId, type ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { applyCouponAction, removeCouponAction, type CheckoutActionState } from "./actions";

/** Trạng thái cục bộ của panel: lỗi (hiện ngay trong panel) hoặc kết quả thành công của lần thao tác gần nhất. */
type PanelState = { error?: string; done?: boolean };

const initialState: PanelState = {};

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const GREEN = brandColors.secondary;
const GREEN_SOFT = `color-mix(in srgb, ${GREEN} 10%, white)`;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

/** Lỗi không mang thông điệp nghiệp vụ (Next.js che `error.message` ở production) → câu an toàn kèm cách xử lý. */
const GENERIC_APPLY_ERROR = "Không áp được mã giảm giá. Vui lòng tải lại trang và thử lại.";
const GENERIC_REMOVE_ERROR = "Không bỏ được mã giảm giá. Vui lòng tải lại trang và thử lại.";
const QR_UPDATED = "Đã cập nhật mã QR theo số tiền mới.";

/**
 * Ô mã giảm giá ở checkout (ADR-056 bổ sung b). Server tạo lại QR + số tiền khi áp/bỏ mã sau khi đã có QR, nên panel
 * báo "Đã cập nhật mã QR theo số tiền mới" khi `hasQrCheckout`. Lỗi của CẢ áp lẫn bỏ mã hiện trong panel (`role="alert"`)
 * thay vì rơi vào error boundary.
 */
export function CouponPanel({
  tenantSlug,
  orderCode,
  appliedCode,
  hasQrCheckout,
}: {
  tenantSlug: string;
  orderCode: string;
  appliedCode: string | null;
  /** Đơn đã có khối QR chuyển khoản (checkoutPayload kiểu QR) — để báo QR được tạo lại sau khi áp/bỏ mã. */
  hasQrCheckout: boolean;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const applyAction = applyCouponAction.bind(null, tenantSlug, orderCode);
  const removeAction = removeCouponAction.bind(null, tenantSlug, orderCode);

  const [applyState, applyFormAction, isApplying] = useActionState(async (_prev: PanelState, formData: FormData): Promise<PanelState> => {
    try {
      const result: CheckoutActionState = await applyAction({}, formData);
      return result.error ? { error: result.error } : { done: true };
    } catch {
      return { error: GENERIC_APPLY_ERROR };
    }
  }, initialState);

  // removeCouponAction trả `CheckoutActionState` (lỗi nghiệp vụ → `error.message`, như nhánh áp mã); `catch` chỉ còn cho lỗi
  // không phải AppError để không rơi vào error boundary.
  const [removeState, removeFormAction, isRemoving] = useActionState(async (prev: PanelState, formData: FormData): Promise<PanelState> => {
    try {
      const r: CheckoutActionState = await removeAction(prev, formData);
      return r.error ? { error: r.error } : { done: true };
    } catch {
      return { error: GENERIC_REMOVE_ERROR };
    }
  }, initialState);

  if (appliedCode) {
    return (
      <div className="space-y-2">
        <form action={removeFormAction} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Mã giảm giá: <strong className="font-semibold">{appliedCode}</strong>
          </span>
          <button
            type="submit"
            disabled={isRemoving}
            aria-label={isRemoving ? "Đang bỏ áp dụng mã giảm giá" : `Bỏ áp dụng mã giảm giá ${appliedCode}`}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 font-medium text-red-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
          >
            {isRemoving ? "Đang bỏ áp dụng..." : "Bỏ áp dụng"}
          </button>
        </form>
        {removeState.error ? <ErrorText>{removeState.error}</ErrorText> : null}
        {applyState.done ? <SuccessText>{hasQrCheckout ? `Đã áp mã giảm giá. ${QR_UPDATED}` : "Đã áp mã giảm giá."}</SuccessText> : null}
      </div>
    );
  }

  const hasError = Boolean(applyState.error);
  return (
    <div className="space-y-2">
      <form action={applyFormAction}>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          Mã giảm giá
        </label>
        <div className="flex items-start gap-2">
          <input
            id={inputId}
            type="text"
            name="couponCode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${errorId} ${hintId}` : hintId}
            className={`min-h-11 w-full min-w-0 flex-1 rounded-lg border bg-white px-3 text-base uppercase ${hasError ? "border-red-700" : ""} ${FOCUS}`}
            style={hasError ? { color: INK } : { borderColor: LINE, color: INK }}
          />
          <button
            type="submit"
            disabled={isApplying}
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white px-4 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}
            style={{ borderColor: LINE, color: INK }}
          >
            {isApplying ? "Đang áp..." : "Áp dụng"}
          </button>
        </div>
        {hasError ? (
          <ErrorText id={errorId} className="mt-1.5">
            {applyState.error}
          </ErrorText>
        ) : null}
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          Nhập mã trước khi chọn cách thanh toán. Nếu áp mã sau, mã QR và số tiền sẽ được cập nhật lại.
        </p>
      </form>
      {removeState.done ? <SuccessText>{hasQrCheckout ? `Đã bỏ mã giảm giá. ${QR_UPDATED}` : "Đã bỏ mã giảm giá."}</SuccessText> : null}
    </div>
  );
}

function ErrorText({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={`text-sm text-red-700 ${className ?? ""}`}>
      {children}
    </p>
  );
}

function SuccessText({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-l-4 px-3 py-2 text-sm" style={{ borderColor: GREEN, background: GREEN_SOFT, color: INK }}>
      {children}
    </p>
  );
}
