"use client";

import {
  useActionState,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
  type SyntheticEvent,
} from "react";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, Notice, PrimaryButton } from "../../_ui/kit";
import { MenuItemButton, MenuItemLink } from "../../_ui/row-menu";
import { IconEye, IconMoreHorizontal, IconRefresh } from "../../_ui/icons";
// `import type` bị xoá hẳn khi biên dịch → không kéo code server (Prisma, email…) vào bundle client.
import type { InvoiceStatusTarget } from "../../../../lib/subscription-billing";
import {
  changeInvoiceStatusAction,
  confirmInvoiceFromTransactionAction,
  confirmManualInvoiceAction,
  type ChangeInvoiceStatusState,
  type ConfirmFromTransactionActionState,
  type ConfirmInvoiceActionState,
} from "./actions";

const initialState: ConfirmInvoiceActionState = {};
const initialTxnState: ConfirmFromTransactionActionState = {};
const initialStatusState: ChangeInvoiceStatusState = {};

/** Lớp nút mở hộp ở ô "Thao tác" (viền màu chính, 44px dưới lg) — dùng chung cho các nút mở `<dialog>` trong file này. */
const TRIGGER_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--color-primary)] bg-white px-3 text-xs font-semibold whitespace-nowrap text-[color:var(--color-primary)] transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none lg:min-h-8";

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
          className={TRIGGER_CLASS}
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

const STATUS_TARGET_LABEL: Record<InvoiceStatusTarget, string> = {
  PAID: "Đã thanh toán",
  PENDING: "Chưa thanh toán (mở lại)",
  VOID: "Huỷ hoá đơn",
};

/** Mô tả hệ quả của từng lựa chọn (đọc kèm qua `aria-describedby` của radio). */
function statusTargetDescription(
  target: InvoiceStatusTarget,
  ctx: { amountLabel: string; autoProvider: boolean; expired: boolean },
): string[] {
  switch (target) {
    case "PAID": {
      const lines = [`Chỉ chọn khi tài khoản đã nhận đủ ${ctx.amountLabel}.`];
      if (ctx.autoProvider) lines.push("Cổng này bình thường tự xác nhận qua webhook — chỉ xác nhận tay khi đã đối chiếu sao kê.");
      if (ctx.expired) lines.push("Kỳ gói được tính lại từ thời điểm xác nhận.");
      return lines;
    }
    case "PENDING":
      return ["Hoá đơn chờ thanh toán lại với hạn mới; kỳ gói tính lại. Chỉ mở lại được hoá đơn mới nhất của gian hàng."];
    case "VOID": {
      const lines = ["Hoá đơn không còn hiệu lực; gói hiện tại không đổi, gian hàng tạo được hoá đơn mới."];
      if (ctx.autoProvider) {
        lines.push("Nếu khách đã chuyển tiền qua cổng này, giao dịch về sau sẽ không tự áp vào hoá đơn đã huỷ — chỉ huỷ khi chắc chắn khách chưa trả.");
      }
      return lines;
    }
  }
}

/** Dữ liệu một hoá đơn cho hộp "Đổi trạng thái…" (ADR-067). */
export interface InvoiceStatusInfo {
  invoiceId: string;
  invoiceCode: string;
  amountLabel: string;
  providerLabel: string;
  currentStatusLabel: string;
  /** Trạng thái được phép chuyển tới (server tính, thứ tự hiển thị giữ nguyên). */
  targets: InvoiceStatusTarget[];
  /** Cổng tự xác nhận qua webhook (SePay/MoMo) — nhắc thêm ở lựa chọn "Đã thanh toán" / "Huỷ hoá đơn". */
  autoProvider: boolean;
  /** Hoá đơn đã hết hạn — lựa chọn "Đã thanh toán" nêu việc tính lại kỳ. */
  expired: boolean;
}

export interface InvoiceStatusDialogHandle {
  open: () => void;
}

/**
 * ADR-067 — hộp "Đổi trạng thái hoá đơn" (không gồm nút mở). Server tính sẵn `targets` và luôn kiểm lại dưới khoá. Nơi dùng giữ
 * `ref` để gọi `open()` và truyền `onClosed` để trả focus về đúng nút đã mở (nút "Đổi trạng thái…" ở trang chi tiết, hoặc nút
 * "⋯" của menu dòng — ADR-069; mục menu đã biến mất khi menu đóng).
 *
 * Cùng mẫu `<dialog>` + `showModal()` với `ManualConfirmButton`: focus tiêu đề khi mở, Esc / "Huỷ bỏ" / nền mờ để đóng (đang
 * gửi thì không đóng); thành công → đóng hộp, phản hồi chính là badge trạng thái (action revalidate) + câu thông báo ẩn cho
 * trình đọc màn hình. Nhóm radio không chọn sẵn, bắt buộc chọn; cả thẻ lựa chọn bấm được (≥ 44px). Nút submit là "Xác nhận",
 * nút đóng là "Huỷ bỏ" — tránh trùng chữ với lựa chọn "Huỷ hoá đơn".
 */
export function InvoiceStatusDialog({
  ref,
  info,
  onClosed,
}: {
  ref: Ref<InvoiceStatusDialogHandle>;
  info: InvoiceStatusInfo;
  onClosed: () => void;
}) {
  const { invoiceId, invoiceCode, amountLabel, providerLabel, currentStatusLabel, targets, autoProvider, expired } = info;
  const action = changeInvoiceStatusAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialStatusState);
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const noteId = `${uid}-note`;
  const noteHintId = `${uid}-note-hint`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // State của action ở lần mở gần nhất: chỉ kết quả MỚI hơn mốc này mới hiện (lỗi cũ không hiện lại khi mở lần sau).
  const [baseline, setBaseline] = useState<ChangeInvoiceStatusState | null>(null);
  const [open, setOpen] = useState(false);
  const fresh = baseline !== null && state !== baseline;
  const error = open && fresh ? state.error : undefined;
  const announced = fresh && state.success ? `Đã đổi trạng thái hoá đơn ${invoiceCode}.` : "";

  // Mỗi kết quả thành công mới → đóng hộp (deps theo object state để lần đổi thứ hai trong cùng dòng vẫn đóng).
  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state]);

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setBaseline(state);
      setOpen(true);
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
    setOpen(false);
    onClosed();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    if (isPending) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDialog();
  }

  const ctx = { amountLabel, autoProvider, expired };

  return (
    <>
      {/* Vùng thông báo chỉ dành cho trình đọc màn hình (sr-only — không để lại khối trống nào trong ô bảng). */}
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
            Đổi trạng thái hoá đơn
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
            Chọn trạng thái mới cho hoá đơn <span className="font-mono [overflow-wrap:anywhere]">{invoiceCode}</span>.
          </p>

          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <dt className="text-gray-600">Mã hoá đơn</dt>
            <dd className="font-mono font-semibold select-all [overflow-wrap:anywhere]">{invoiceCode}</dd>
            <dt className="text-gray-600">Số tiền</dt>
            <dd className="font-semibold tabular-nums">{amountLabel}</dd>
            <dt className="text-gray-600">Cổng</dt>
            <dd>{providerLabel}</dd>
            <dt className="text-gray-600">Trạng thái hiện tại</dt>
            <dd>{currentStatusLabel}</dd>
          </dl>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium">
              Chuyển sang <span className="font-normal text-gray-600">(bắt buộc chọn)</span>
            </legend>
            <div className="mt-2 space-y-2">
              {targets.map((target) => {
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
                        {STATUS_TARGET_LABEL[target]}
                      </label>
                      <p id={optionDescId} className="mt-0.5 text-xs leading-relaxed text-gray-600">
                        {statusTargetDescription(target, ctx).join(" ")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {targets.includes("PAID") ? (
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
            maxLength={500}
            aria-describedby={noteHintId}
            placeholder="VD: lý do đổi, mã GD ngân hàng"
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
              Huỷ bỏ
            </GhostButton>
            <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Xác nhận"}</PrimaryButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * Nút "Đổi trạng thái…" + hộp (ADR-067) — dùng ở bảng "Lịch sử hoá đơn gói" của trang chi tiết thuê bao (ADR-069). Nhãn gọn
 * "Đổi…" dưới md; mã hoá đơn nằm trong `sr-only` (tên truy cập bắt đầu đúng bằng chữ hiển thị).
 */
export function InvoiceStatusButton({ align = "end", ...info }: InvoiceStatusInfo & { align?: "start" | "end" }) {
  const dialogRef = useRef<InvoiceStatusDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={`inline-flex flex-col ${align === "end" ? "items-end" : "items-start"}`}>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => dialogRef.current?.open()} className={TRIGGER_CLASS}>
        <span className="md:hidden">Đổi…</span>
        <span className="hidden md:inline">Đổi trạng thái…</span>
        <span className="sr-only">{` hoá đơn ${info.invoiceCode}`}</span>
      </button>
      <InvoiceStatusDialog ref={dialogRef} info={info} onClosed={() => triggerRef.current?.focus()} />
    </div>
  );
}

const MENU_GAP = 4;
const VIEWPORT_EDGE = 8;

/**
 * ADR-069 — menu dòng "⋯" ở cột "Thao tác" (/admin/subscriptions, tab "Tất cả" của /admin/billing/invoices): "Xem chi tiết"
 * (trang chi tiết thuê bao, khi có `detailHref`) + "Đổi trạng thái hoá đơn…" (khi `status.targets` khác rỗng, mở hộp ADR-067).
 * Không có mục nào → nơi gọi hiện "—".
 *
 * KHÔNG dùng `RowMenu` của kit ở đây: hai trang này bọc bảng trong `overflow-x-auto` (bảng nhiều cột) — menu `position:absolute`
 * của kit bị khung cắt và làm khung hiện thanh cuộn dọc (overflow-x khác `visible` kéo overflow-y thành `auto`). Menu ở đây là
 * popover (`popover="auto"`, top layer — không bị overflow/transform của tổ tiên cắt), đặt `position:fixed` theo toạ độ nút "⋯":
 * căn mép phải nút, kẹp trong viewport, thiếu chỗ phía dưới thì mở lên trên. Bấm ra ngoài đóng (light dismiss của popover), Esc
 * đóng + trả focus về nút, Tab rời menu thì đóng, cuộn/resize thì đóng (không để menu lơ lửng lệch dòng). Mở menu → focus mục
 * đầu; ↑/↓/Home/End di chuyển giữa các mục. Hộp đổi trạng thái nằm ngoài menu; đóng hộp → focus về nút "⋯".
 */
export function InvoiceRowMenu({
  label,
  detailHref,
  status,
}: {
  /** Tên truy cập của nút "⋯", vd "Thao tác đơn hàng gói của Gian hàng A". */
  label: string;
  detailHref: string | null;
  status: InvoiceStatusInfo | null;
}) {
  const dialogRef = useRef<InvoiceStatusDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pointerPress = useRef<{ wasOpen: boolean } | null>(null);
  const lastClosedAt = useRef(0);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const canChangeStatus = status !== null && status.targets.length > 0;

  function menuItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function isMenuOpen(): boolean {
    const menu = menuRef.current;
    // Trình duyệt chưa hỗ trợ Popover API: `:popover-open` làm `matches()` ném lỗi.
    if (!menu || typeof menu.showPopover !== "function") return false;
    return menu.matches(":popover-open");
  }

  function placeMenu() {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const anchor = trigger.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    let top = anchor.bottom + MENU_GAP;
    // Dòng sát đáy viewport: mở lên trên nếu phía trên đủ chỗ.
    if (top + box.height > window.innerHeight - VIEWPORT_EDGE && anchor.top - MENU_GAP - box.height >= VIEWPORT_EDGE) {
      top = anchor.top - MENU_GAP - box.height;
    }
    const left = Math.min(Math.max(VIEWPORT_EDGE, anchor.right - box.width), window.innerWidth - box.width - VIEWPORT_EDGE);
    menu.style.top = `${Math.max(VIEWPORT_EDGE, top)}px`;
    menu.style.left = `${Math.max(VIEWPORT_EDGE, left)}px`;
  }

  function openMenu(focus: "first" | "last") {
    const menu = menuRef.current;
    if (!menu || typeof menu.showPopover !== "function" || isMenuOpen()) return;
    menu.showPopover();
    placeMenu();
    const items = menuItems();
    (focus === "first" ? items[0] : items[items.length - 1])?.focus();
  }

  function closeMenu(returnFocus: boolean) {
    if (isMenuOpen()) menuRef.current?.hidePopover();
    if (returnFocus) triggerRef.current?.focus();
  }

  // Đồng bộ `aria-expanded` với trạng thái popover (kể cả khi đóng bằng light dismiss / khi hộp modal mở).
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    function onToggle(event: Event) {
      const isOpen = (event as ToggleEvent).newState === "open";
      if (!isOpen) lastClosedAt.current = performance.now();
      setOpen(isOpen);
    }
    menu.addEventListener("toggle", onToggle);
    return () => menu.removeEventListener("toggle", onToggle);
  }, []);

  // Đang mở: cuộn (trang hoặc khung bảng) / đổi kích thước → đóng, tránh menu lệch khỏi dòng của nó.
  useEffect(() => {
    if (!open) return;
    function close() {
      const menu = menuRef.current;
      if (menu && typeof menu.showPopover === "function" && menu.matches(":popover-open")) menu.hidePopover();
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  }

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onPointerDown={() => {
          // Bấm chuột vào chính nút "⋯" khi menu đang mở: light dismiss của popover đóng menu TRƯỚC sự kiện click → nhớ trạng
          // thái lúc nhấn (và mốc vừa đóng) để click không mở lại ngay menu vừa đóng.
          pointerPress.current = { wasOpen: isMenuOpen() };
        }}
        onClick={() => {
          const press = pointerPress.current;
          pointerPress.current = null;
          const justDismissed = press !== null && performance.now() - lastClosedAt.current < 500;
          if (isMenuOpen()) closeMenu(false);
          else if (!(press?.wasOpen || justDismissed)) openMenu("first");
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 motion-reduce:transition-none lg:h-8 lg:w-8"
      >
        <IconMoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={handleMenuKeyDown}
        onClick={(event) => {
          // Bấm một mục → đóng menu (Link vẫn điều hướng; mục mở hộp đã gọi `open()` trước — hộp tự nhận focus).
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) closeMenu(false);
        }}
        // Ghi đè style mặc định của popover (inset:0 + margin:auto = giữa màn hình); toạ độ đặt bằng `placeMenu()`.
        className="fixed inset-auto m-0 w-56 overflow-hidden rounded-lg border bg-white px-0 py-1 text-left shadow-lg"
        style={{ borderColor: "#E5E7EB" }}
      >
        {detailHref ? (
          <MenuItemLink href={detailHref} icon={<IconEye />}>
            Xem chi tiết
          </MenuItemLink>
        ) : null}
        {canChangeStatus ? (
          <MenuItemButton type="button" aria-haspopup="dialog" icon={<IconRefresh />} onClick={() => dialogRef.current?.open()}>
            Đổi trạng thái hoá đơn…
          </MenuItemButton>
        ) : null}
      </div>
      {canChangeStatus ? <InvoiceStatusDialog ref={dialogRef} info={status} onClosed={() => triggerRef.current?.focus()} /> : null}
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
