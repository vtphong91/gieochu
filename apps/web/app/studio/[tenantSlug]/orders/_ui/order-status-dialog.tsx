"use client";

import { useActionState, useEffect, useId, useImperativeHandle, useRef, useState, type MouseEvent, type Ref, type SyntheticEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, Notice, PrimaryButton } from "../../../../admin/_ui/kit";
// `import type` bị xoá hẳn khi biên dịch → không kéo code server (Prisma…) vào bundle client.
import type { OrderStatusTarget } from "../../../../../lib/order";
import { changeOrderStatusAction, type ChangeOrderStatusState } from "../[orderId]/actions";

/*
 * ADR-068 — hộp "Đổi trạng thái…" đơn hàng Studio, dùng ở menu "Thao tác" của danh sách và khối Thao tác của trang chi tiết.
 * Cùng chuẩn với hộp "Đổi trạng thái…" hoá đơn gói ở System Center (ADR-067): `<dialog>` + `showModal()` (top layer, nền `inert`),
 * focus tiêu đề khi mở, Esc / "Huỷ bỏ" / bấm nền để đóng (đang gửi thì không đóng), đóng xong trả focus về nơi mở; thành công →
 * đóng hộp, phản hồi chính là badge trạng thái (action revalidate) + câu thông báo ẩn cho trình đọc màn hình. Nhóm radio chỉ gồm
 * `targets` do server tính (server kiểm lại khi thực hiện), không chọn sẵn, bắt buộc chọn; cả thẻ lựa chọn bấm được (≥ 44px).
 * "Huỷ bỏ" (đóng hộp) khác chữ với lựa chọn "Huỷ đơn".
 */

const TARGET_LABEL: Record<OrderStatusTarget, string> = {
  PAID: "Đã thanh toán",
  PENDING: "Chưa thanh toán (mở lại)",
  CANCELLED: "Huỷ đơn",
};

const NOTE_MAX = 500;

const initialState: ChangeOrderStatusState = {};

export interface OrderStatusInfo {
  orderId: string;
  code: string;
  /** Tổng tiền đã định dạng (vd "993.000 đ"). */
  totalLabel: string;
  currentStatusLabel: string;
  /** Trạng thái được phép chuyển tới (server tính, giữ thứ tự). */
  targets: OrderStatusTarget[];
  /** Trạng thái hiệu lực là EXPIRED — lựa chọn "Đã thanh toán" nhắc thêm. */
  expired: boolean;
  /**
   * Cổng tự xác nhận (SePay/MoMo) — lựa chọn "Huỷ đơn" nhắc giao dịch về sau không tự áp. `null` = chưa biết cổng → vẫn nhắc
   * (an toàn hơn bỏ sót cảnh báo).
   */
  autoProvider: boolean | null;
}

function targetDescription(target: OrderStatusTarget, info: OrderStatusInfo): string {
  switch (target) {
    case "PAID":
      return [
        `Chỉ chọn khi đã nhận đủ ${info.totalLabel}. Khách nhận quyền tải tài liệu và email xác nhận.`,
        info.expired ? "Đơn đã hết hạn — chỉ xác nhận khi tiền thực sự đã về." : null,
      ]
        .filter(Boolean)
        .join(" ");
    case "PENDING":
      return "Đơn chờ thanh toán lại với hạn giữ mới; giữ giá và mã giảm giá cũ. Khách không nhận email báo mở lại.";
    case "CANCELLED":
      return [
        "Khách không thanh toán tiếp được.",
        info.autoProvider !== false ? "Nếu khách đã chuyển tiền, giao dịch về sau sẽ không tự áp vào đơn đã huỷ." : null,
      ]
        .filter(Boolean)
        .join(" ");
  }
}

export interface OrderStatusDialogHandle {
  open: () => void;
}

/**
 * Hộp đổi trạng thái (không gồm nút mở). Nơi dùng giữ `ref` để gọi `open()` và truyền `onClosed` để trả focus về đúng nút
 * đã mở (nút "Đổi trạng thái…" ở trang chi tiết, hoặc nút "…" của menu dòng — mục menu đã biến mất khi menu đóng).
 */
export function OrderStatusDialog({
  ref,
  tenantSlug,
  info,
  onClosed,
}: {
  ref: Ref<OrderStatusDialogHandle>;
  tenantSlug: string;
  info: OrderStatusInfo;
  onClosed: () => void;
}) {
  const action = changeOrderStatusAction.bind(null, tenantSlug, info.orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const noteId = `${uid}-note`;
  const noteHintId = `${uid}-note-hint`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // State của action ở lần mở gần nhất: chỉ kết quả MỚI hơn mốc này mới hiện (lỗi cũ không hiện lại khi mở lần sau).
  const [baseline, setBaseline] = useState<ChangeOrderStatusState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const fresh = baseline !== null && state !== baseline;
  const error = isOpen && fresh ? state.error : undefined;
  const announced = fresh && state.success ? `Đã đổi trạng thái đơn ${info.code}.` : "";

  // Mỗi kết quả thành công mới → đóng hộp (deps theo object state: lần đổi thứ hai trong cùng dòng vẫn đóng).
  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state]);

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setBaseline(state);
      setIsOpen(true);
      formRef.current?.reset();
      dialog.showModal();
      // Focus tiêu đề: trình đọc màn hình đọc tên + mô tả hộp trước; không bật bàn phím ảo trên mobile.
      titleRef.current?.focus();
    },
  }));

  function closeDialog() {
    if (!isPending) dialogRef.current?.close();
  }

  function handleClosed() {
    setIsOpen(false);
    onClosed();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (isPending) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDialog();
  }

  return (
    <>
      {/* Vùng thông báo chỉ dành cho trình đọc màn hình (sr-only — không để lại khối nào trên giao diện). */}
      <span role="status" className="sr-only">
        {announced}
      </span>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={handleClosed}
        onCancel={handleCancel}
        onClick={handleBackdropClick}
        // Không đặt `flex`/`block` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở <form> con.
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        style={{ color: brandColors.ink }}
      >
        <form ref={formRef} action={formAction} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="font-[family-name:var(--font-heading)] text-lg leading-snug font-semibold outline-none"
          >
            Đổi trạng thái đơn hàng
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
            Chọn trạng thái mới cho đơn <span className="font-mono [overflow-wrap:anywhere]">{info.code}</span>.
          </p>

          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <dt className="text-gray-600">Mã đơn</dt>
            <dd className="font-mono font-semibold select-all [overflow-wrap:anywhere]">{info.code}</dd>
            <dt className="text-gray-600">Tổng tiền</dt>
            <dd className="font-semibold tabular-nums">{info.totalLabel}</dd>
            <dt className="text-gray-600">Trạng thái hiện tại</dt>
            <dd>{info.currentStatusLabel}</dd>
          </dl>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">
              Chuyển sang <span className="font-normal text-gray-600">(bắt buộc chọn)</span>
            </legend>
            <div className="mt-2 space-y-2">
              {info.targets.map((target) => {
                const optionId = `${uid}-target-${target}`;
                const optionDescId = `${optionId}-desc`;
                return (
                  <div
                    key={target}
                    className="relative flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 transition-colors hover:bg-gray-50 has-[:checked]:border-[color:var(--color-primary)] has-[:checked]:bg-[color:var(--color-primary)]/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-primary)] motion-reduce:transition-none"
                  >
                    <input
                      id={optionId}
                      type="radio"
                      name="target"
                      value={target}
                      required
                      aria-describedby={optionDescId}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[color:var(--color-primary)] focus-visible:outline-none"
                    />
                    <div className="min-w-0">
                      {/* `after:inset-0` phủ cả thẻ → bấm vào bất kỳ đâu trên thẻ cũng chọn radio (vùng bấm ≥ 44px). */}
                      <label htmlFor={optionId} className="cursor-pointer text-sm font-semibold after:absolute after:inset-0 after:rounded-xl">
                        {TARGET_LABEL[target]}
                      </label>
                      <p id={optionDescId} className="mt-0.5 text-xs leading-relaxed text-gray-600">
                        {targetDescription(target, info)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {info.targets.includes("PAID") ? (
            <div className="mt-3">
              <Notice tone="warning">
                <p>
                  <strong className="font-semibold">Không hoàn tác được với Đã thanh toán.</strong>
                </p>
              </Notice>
            </div>
          ) : null}

          <label htmlFor={noteId} className="mt-4 block text-sm font-medium">
            Ghi chú <span className="font-normal text-gray-600">(không bắt buộc)</span>
          </label>
          <textarea
            id={noteId}
            name="note"
            rows={3}
            maxLength={NOTE_MAX}
            aria-describedby={noteHintId}
            placeholder="VD: đã đối chiếu sao kê lúc 10:30"
            className="mt-1.5 w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-base outline-none transition-colors focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/15 motion-reduce:transition-none lg:text-sm"
          />
          <p id={noteHintId} className="mt-1.5 text-xs text-gray-600">
            Ghi chú lưu vào ghi chú nội bộ của đơn — khách không thấy. Tối đa {NOTE_MAX} ký tự.
          </p>

          {error ? (
            <div className="mt-3">
              <FormBanner ok={false} message={error} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton disabled={isPending} onClick={closeDialog}>
              Huỷ bỏ
            </GhostButton>
            <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Xác nhận"}</PrimaryButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Nút "Đổi trạng thái…" + hộp — khối Thao tác của trang chi tiết đơn (full-width trong cột phụ). */
export function OrderStatusButton({ tenantSlug, info }: { tenantSlug: string; info: OrderStatusInfo }) {
  const dialogRef = useRef<OrderStatusDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.open()}
        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[color:var(--color-primary)] bg-white px-4 text-sm font-semibold text-[color:var(--color-primary)] transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none lg:min-h-10"
      >
        Đổi trạng thái…
        <span className="sr-only">{` đơn ${info.code}`}</span>
      </button>
      <OrderStatusDialog ref={dialogRef} tenantSlug={tenantSlug} info={info} onClosed={() => triggerRef.current?.focus()} />
    </div>
  );
}
