"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { markOrderRefundedAction, type OrderActionState } from "../[orderId]/actions";
import type { OrderRowAction } from "../../../../../lib/order";
import { MenuItemButton, MenuItemLink, MenuSeparator, RowMenu } from "../../../../admin/_ui/row-menu";
import { IconEye, IconReceipt, IconRefresh } from "../../../../admin/_ui/icons";
import { OrderStatusDialog, type OrderStatusDialogHandle, type OrderStatusInfo } from "./order-status-dialog";

/*
 * ADR-046 + ADR-068 — menu "Thao tác" của 1 dòng đơn hàng: "Xem chi tiết", "Đổi trạng thái…" (khi server cho phép chuyển — Đã
 * thanh toán / mở lại / huỷ, hộp chung `OrderStatusDialog`), "Đánh dấu đã hoàn tiền…" (đơn hoàn tất, hộp xác nhận riêng gọi
 * `markOrderRefundedAction`). Các hộp nằm NGOÀI menu (menu tự đóng khi bấm): `<dialog>` + `showModal()` — bẫy focus, Esc đóng,
 * đóng xong trả focus về nút "…" mở menu.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

const initialState: OrderActionState = {};

export function OrderRowActions({
  tenantSlug,
  orderId,
  code,
  detailHref,
  actions,
  status,
}: {
  tenantSlug: string;
  orderId: string;
  code: string;
  detailHref: string;
  /** Thao tác hợp lệ do loader tính (`orderAllowedActions`) — ở đây chỉ còn dùng "refund". */
  actions: OrderRowAction[];
  /** Dữ liệu hộp "Đổi trạng thái…" (ADR-068); `targets` rỗng → không có mục này. */
  status: OrderStatusInfo;
}) {
  const [refundOpen, setRefundOpen] = useState(false);
  const refundDialogRef = useRef<HTMLDialogElement>(null);
  const statusDialogRef = useRef<OrderStatusDialogHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [refundState, refundAction, refunding] = useActionState(markOrderRefundedAction.bind(null, tenantSlug, orderId), initialState);
  const lastRefundState = useRef<OrderActionState>(refundState);

  useEffect(() => {
    const dialog = refundDialogRef.current;
    if (refundOpen && dialog && !dialog.open) dialog.showModal();
  }, [refundOpen]);

  // Action trả state mới (object khác) mỗi lần chạy xong: không lỗi → đóng hộp (danh sách đã revalidate).
  useEffect(() => {
    const prev = lastRefundState.current;
    lastRefundState.current = refundState;
    if (refundOpen && refundState !== prev && !refundState.error) refundDialogRef.current?.close();
  }, [refundState, refundOpen]);

  function focusMenuTrigger() {
    wrapRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')?.focus();
  }

  function onRefundClose() {
    setRefundOpen(false);
    focusMenuTrigger();
  }

  const titleId = `row-refund-title-${orderId}`;
  const descId = `row-refund-desc-${orderId}`;
  const canChangeStatus = status.targets.length > 0;
  const canRefund = actions.includes("refund");

  return (
    <div ref={wrapRef} className="inline-flex">
      <RowMenu label={`Thao tác đơn ${code}`} size="touch">
        <MenuItemLink href={detailHref} icon={<IconEye />}>
          Xem chi tiết
        </MenuItemLink>
        {canChangeStatus || canRefund ? <MenuSeparator /> : null}
        {canChangeStatus ? (
          <MenuItemButton type="button" aria-haspopup="dialog" icon={<IconRefresh />} onClick={() => statusDialogRef.current?.open()}>
            Đổi trạng thái…
          </MenuItemButton>
        ) : null}
        {canRefund ? (
          <MenuItemButton type="button" aria-haspopup="dialog" icon={<IconReceipt />} onClick={() => setRefundOpen(true)}>
            Đánh dấu đã hoàn tiền…
          </MenuItemButton>
        ) : null}
      </RowMenu>

      {canChangeStatus ? <OrderStatusDialog ref={statusDialogRef} tenantSlug={tenantSlug} info={status} onClosed={focusMenuTrigger} /> : null}

      {refundOpen ? (
        <dialog
          ref={refundDialogRef}
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClose={onRefundClose}
          className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        >
          <form action={refundAction} className="p-5 sm:p-6">
            <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-lg font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
              Đánh dấu đơn {code} đã hoàn tiền?
            </h2>
            <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
              Chỉ xác nhận khi bạn đã chuyển trả tiền cho khách qua kênh đã nhận thanh toán. Hệ thống không tự chuyển tiền; quyền tải tài
              liệu của khách sẽ bị thu hồi.
            </p>
            {refundState.error ? (
              <p role="alert" className="mt-3 text-sm" style={{ color: RED }}>
                {refundState.error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => refundDialogRef.current?.close()}
                className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`}
                style={{ color: INK }}
              >
                Thôi
              </button>
              <button type="submit" disabled={refunding} className={`${BTN} text-white hover:brightness-110`} style={{ background: brandColors.primary }}>
                {refunding ? "Đang xử lý..." : "Đã hoàn tiền"}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
