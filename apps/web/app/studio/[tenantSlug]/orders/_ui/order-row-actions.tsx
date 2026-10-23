"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { cancelOrderAction, markOrderRefundedAction, type OrderActionState } from "../[orderId]/actions";
import type { OrderRowAction } from "../../../../../lib/order";
import { MenuItemButton, MenuItemLink, MenuSeparator, RowMenu } from "../../../../admin/_ui/row-menu";
import { IconCheckCircle, IconEye, IconReceipt, IconXCircle } from "../../../../admin/_ui/icons";

/*
 * ADR-046 — menu "Thao tác" của 1 dòng đơn hàng. "Xác nhận thanh toán" cần ghi chú → link sang khối Thao tác của trang
 * chi tiết. "Huỷ đơn" / "Đánh dấu đã hoàn tiền" mở hộp xác nhận (bước 2) ngay tại danh sách rồi gọi thẳng action có sẵn
 * (`cancelOrderAction` / `markOrderRefundedAction` — tự kiểm quyền, revalidate danh sách). Hộp xác nhận nằm NGOÀI menu
 * (menu tự đóng khi bấm): `<dialog>` + `showModal()` — bẫy focus, Esc đóng, focus mặc định vào nút an toàn, đóng xong
 * trả focus về nút mở menu.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

const initialState: OrderActionState = {};

type Mode = "cancel" | "refund";

const COPY: Record<Mode, { title: (code: string) => string; text: string; keep: string; confirm: string; pending: string; danger: boolean }> = {
  cancel: {
    title: (code) => `Huỷ đơn ${code}?`,
    text: "Đơn chuyển sang “Đã huỷ” và khách không thanh toán tiếp được. Thao tác này không hoàn tác được.",
    keep: "Giữ đơn",
    confirm: "Huỷ đơn",
    pending: "Đang huỷ...",
    danger: true,
  },
  refund: {
    title: (code) => `Đánh dấu đơn ${code} đã hoàn tiền?`,
    text: "Chỉ xác nhận khi bạn đã chuyển trả tiền cho khách qua kênh đã nhận thanh toán. Hệ thống không tự chuyển tiền; quyền tải tài liệu của khách sẽ bị thu hồi.",
    keep: "Thôi",
    confirm: "Đã hoàn tiền",
    pending: "Đang xử lý...",
    danger: false,
  },
};

export function OrderRowActions({
  tenantSlug,
  orderId,
  code,
  detailHref,
  actionsHref,
  actions,
}: {
  tenantSlug: string;
  orderId: string;
  code: string;
  detailHref: string;
  /** Link chi tiết neo tới khối Thao tác đơn (`#order-actions`). */
  actionsHref: string;
  /** Thao tác hợp lệ do loader tính (`orderAllowedActions`). */
  actions: OrderRowAction[];
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cancelState, cancelAction, canceling] = useActionState(cancelOrderAction.bind(null, tenantSlug, orderId), initialState);
  const [refundState, refundAction, refunding] = useActionState(markOrderRefundedAction.bind(null, tenantSlug, orderId), initialState);
  const state = mode === "refund" ? refundState : cancelState;
  const isPending = mode === "refund" ? refunding : canceling;
  const lastState = useRef<{ cancel: OrderActionState; refund: OrderActionState }>({ cancel: cancelState, refund: refundState });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (mode && dialog && !dialog.open) dialog.showModal();
  }, [mode]);

  // Action trả state mới (object khác) mỗi lần chạy xong: không lỗi → đóng hộp (danh sách đã revalidate).
  useEffect(() => {
    const prev = lastState.current;
    lastState.current = { cancel: cancelState, refund: refundState };
    const changed = (mode === "cancel" && cancelState !== prev.cancel) || (mode === "refund" && refundState !== prev.refund);
    if (changed && !(mode === "refund" ? refundState : cancelState).error) dialogRef.current?.close();
  }, [cancelState, refundState, mode]);

  function onClose() {
    setMode(null);
    wrapRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
  }

  const copy = mode ? COPY[mode] : null;
  const titleId = `row-confirm-title-${orderId}`;
  const descId = `row-confirm-desc-${orderId}`;

  return (
    <div ref={wrapRef} className="inline-flex">
      <RowMenu label={`Thao tác đơn ${code}`} size="touch">
        <MenuItemLink href={detailHref} icon={<IconEye />}>
          Xem chi tiết
        </MenuItemLink>
        {actions.includes("confirm") ? (
          <MenuItemLink href={actionsHref} icon={<IconCheckCircle />}>
            Xác nhận thanh toán
          </MenuItemLink>
        ) : null}
        {actions.includes("refund") ? (
          <MenuItemButton type="button" icon={<IconReceipt />} onClick={() => setMode("refund")}>
            Đánh dấu đã hoàn tiền…
          </MenuItemButton>
        ) : null}
        {actions.includes("cancel") ? (
          <>
            <MenuSeparator />
            <MenuItemButton type="button" tone="danger" icon={<IconXCircle />} onClick={() => setMode("cancel")}>
              Huỷ đơn…
            </MenuItemButton>
          </>
        ) : null}
      </RowMenu>

      {mode && copy ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClose={onClose}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        >
          <form action={mode === "refund" ? refundAction : cancelAction} className="p-5 sm:p-6">
            <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-lg font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
              {copy.title(code)}
            </h2>
            <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
              {copy.text}
            </p>
            {state.error ? (
              <p role="alert" className="mt-3 text-sm" style={{ color: RED }}>
                {state.error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => dialogRef.current?.close()}
                className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`}
                style={{ color: INK }}
              >
                {copy.keep}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`${BTN} text-white hover:brightness-110`}
                style={{ background: copy.danger ? RED : brandColors.primary }}
              >
                {isPending ? copy.pending : copy.confirm}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
