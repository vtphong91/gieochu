"use client";

import { useActionState, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { ConfirmDialog, LIBRARY_BTN, LIBRARY_ERROR_RED } from "../../../../account/library/_ui/confirm-dialog";
import { IconCheckCircle } from "../../../../admin/_ui/icons";
import { cancelOrderByCustomerAction, declarePaidAction, undoDeclarePaidAction, type CheckoutActionState } from "../actions";
import { clearFocusIntent, requestFocusAfterUpdate } from "../checkout-poll";
import { GHOST_BTN, MobileActionBar, PRIMARY_BTN, STATE_HEADING_ID } from "./checkout-parts";

/*
 * Hành động của khách trên trang thanh toán (ADR-062 Q1/Q4). Server Action trả `{ ok }` hoặc `{ error, code }`; thành công →
 * `revalidatePath` làm trang render lại theo trạng thái mới, `CheckoutStatusAnnouncer` đọc câu trạng thái mới (một vùng
 * `role="status"` duy nhất — không đọc trùng ở đây). Ở đây chỉ hiện lỗi (`role="alert"`) và dời focus về tiêu đề khối trạng
 * thái vì nút vừa bấm biến mất sau khi trạng thái đổi.
 */

const LINE = brandColors.line;
const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;

type Bound = (prev: CheckoutActionState, formData: FormData) => Promise<CheckoutActionState>;

/**
 * useActionState + bắt lỗi không phải AppError (Next che message ở production). Lúc gửi đăng ký ý định focus tiêu đề khối
 * trạng thái (`CheckoutPoll` thực hiện khi trạng thái đổi); lỗi → huỷ ý định.
 */
function useCheckoutAction(bound: Bound, genericError: string) {
  return useActionState(async (prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> => {
    requestFocusAfterUpdate(STATE_HEADING_ID);
    let result: CheckoutActionState;
    try {
      result = await bound(prev, formData);
    } catch {
      result = { error: genericError };
    }
    if (!result.ok) clearFocusIntent();
    return result;
  }, {});
}

function ErrorText({ children }: { children: string }) {
  return (
    <p role="alert" className="text-sm font-medium" style={{ color: LIBRARY_ERROR_RED }}>
      {children}
    </p>
  );
}

/**
 * Nút chính "Tôi đã chuyển khoản" (chỉ cổng xác nhận thủ công, `can.declarePaid`). Một state cho hai vị trí: cột phải (từ lg)
 * và thanh dính đáy (mobile) — mỗi vị trí ẩn ở breakpoint còn lại (`display:none`, không trùng trong cây a11y).
 */
export function DeclarePaidAction({ tenantSlug, orderCode, totalVnd }: { tenantSlug: string; orderCode: string; totalVnd: number }) {
  const [state, formAction, pending] = useCheckoutAction(
    declarePaidAction.bind(null, tenantSlug, orderCode),
    "Chưa ghi nhận được. Vui lòng tải lại trang và thử lại.",
  );
  const label = pending ? "Đang ghi nhận..." : "Tôi đã chuyển khoản";
  return (
    <form action={formAction}>
      <div className="hidden space-y-2 lg:block">
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={`${PRIMARY_BTN} w-full`} style={{ background: "var(--color-primary)" }}>
          <IconCheckCircle className="h-5 w-5" />
          {label}
        </button>
        <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          Bấm sau khi đã chuyển tiền — người bán sẽ được báo để đối chiếu.
        </p>
        {state.error ? <ErrorText>{state.error}</ErrorText> : null}
      </div>
      <MobileActionBar totalVnd={totalVnd}>
        <div className="flex w-full max-w-64 flex-col items-end gap-1">
          <button type="submit" disabled={pending} aria-busy={pending || undefined} className={`${PRIMARY_BTN} w-full px-4 text-[15px]`} style={{ background: "var(--color-primary)" }}>
            {label}
          </button>
          {state.error ? <ErrorText>{state.error}</ErrorText> : null}
        </div>
      </MobileActionBar>
    </form>
  );
}

/** "Tôi chưa chuyển khoản" — hoàn tác báo đã chuyển (`can.undoDeclarePaid`). Không cần hộp xác nhận: làm lại được ngay. */
export function UndoDeclarePaidAction({ tenantSlug, orderCode }: { tenantSlug: string; orderCode: string }) {
  const [state, formAction, pending] = useCheckoutAction(
    undoDeclarePaidAction.bind(null, tenantSlug, orderCode),
    "Chưa hoàn tác được. Vui lòng tải lại trang và thử lại.",
  );
  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
        Bấm nhầm hoặc chưa chuyển tiền?
      </p>
      <button type="submit" disabled={pending} aria-busy={pending || undefined} className={GHOST_BTN} style={{ borderColor: LINE, color: INK }}>
        {pending ? "Đang hoàn tác..." : "Tôi chưa chuyển khoản"}
      </button>
      {state.error ? <ErrorText>{state.error}</ErrorText> : null}
    </form>
  );
}

/** "Huỷ đơn" (`can.cancel`) — luôn qua hộp xác nhận (`ConfirmDialog` dùng chung phía khách). */
export function CancelOrderAction({ tenantSlug, orderCode }: { tenantSlug: string; orderCode: string }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  // Thành công → đơn CANCELED, trang render lại không còn nút này (component + hộp thoại unmount).
  const [state, formAction, pending] = useCheckoutAction(
    cancelOrderByCustomerAction.bind(null, tenantSlug, orderCode),
    "Chưa huỷ được đơn. Vui lòng tải lại trang và thử lại.",
  );

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded-lg px-2 text-sm font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]`}
        style={{ color: LIBRARY_ERROR_RED }}
      >
        Huỷ đơn
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        busy={pending}
        returnFocusRef={openerRef}
        title={`Huỷ đơn ${orderCode}?`}
        description={
          <p>
            Đơn sẽ bị huỷ và mã QR không còn dùng được. <strong className="font-semibold">Nếu bạn đã chuyển tiền, đừng huỷ</strong> — hãy bấm “Tôi đã
            chuyển khoản” để người bán đối chiếu.
          </p>
        }
        error={state.error}
        cancelLabel="Giữ đơn"
        confirm={
          <form action={formAction}>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className={`${LIBRARY_BTN} w-full text-white sm:w-auto`}
              style={{ background: LIBRARY_ERROR_RED }}
            >
              {pending ? "Đang huỷ..." : "Huỷ đơn"}
            </button>
          </form>
        }
      >
        <p style={{ color: INK }}>Bạn có thể đặt lại đơn mới từ trang tài liệu bất cứ lúc nào.</p>
      </ConfirmDialog>
    </>
  );
}
