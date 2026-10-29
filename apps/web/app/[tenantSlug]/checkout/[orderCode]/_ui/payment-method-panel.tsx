"use client";

import { useActionState, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { PaymentProviderId } from "@gieochu/payments";
import type { CheckoutProviderOption } from "../../../../../lib/checkout-view";
import { IconAlertTriangle, IconBank, IconWallet } from "../../../../admin/_ui/icons";
import { selectProviderAction, type CheckoutActionState } from "../actions";
import { clearFocusIntent, requestFocusAfterUpdate } from "../checkout-poll";
import { GHOST_BTN, MobileActionBar, NEUTRAL_SOFT, PAYMENT_HEADING_ID, PRIMARY_BTN } from "./checkout-parts";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
/** Nền thẻ phương thức bị vô hiệu — chữ vẫn đủ tương phản (không làm mờ cả thẻ bằng opacity). */
const DISABLED_BG = NEUTRAL_SOFT;
const ERROR_RED = "#B91C1C";
const GENERIC_ERROR = "Không đổi được cách thanh toán. Vui lòng tải lại trang và thử lại.";

/** Mô tả 1 dòng cho khách (ADR-062 §4.3) — nhãn chính lấy từ view model (`option.label`). */
const DESCRIPTION: Record<PaymentProviderId, string> = {
  MANUAL_QR: "Quét QR bằng app ngân hàng. Người bán xác nhận thủ công.",
  SEPAY: "Quét QR bằng app ngân hàng. Hệ thống tự xác nhận vài phút sau khi bạn chuyển.",
  MOMO_MANUAL: "Chuyển qua app MoMo. Người bán xác nhận thủ công.",
  MOMO: "Thanh toán trên trang của MoMo.",
};

function ProviderIcon({ id, className }: { id: PaymentProviderId; className?: string }) {
  return id === "MOMO" || id === "MOMO_MANUAL" ? <IconWallet className={className} /> : <IconBank className={className} />;
}

/**
 * Một thẻ radio phương thức (cả thẻ là `label`, ≥56px, viền primary khi chọn, focus ring trên cả thẻ). Dùng chung cho
 * `PaymentMethodPanel` (trang đơn) và form khách vãng lai chưa có đơn (`../../_ui/guest-checkout-form.tsx`) — một kiểu, một
 * chỗ sửa a11y.
 */
export function ProviderOptionCard({
  option,
  defaultChecked,
  disabled = false,
  isCurrent = false,
  unavailableReason,
  inputId,
  describedBy,
}: {
  option: { id: PaymentProviderId; label: string };
  defaultChecked: boolean;
  disabled?: boolean;
  isCurrent?: boolean;
  /** Có giá trị → thẻ ghi lý do không dùng được (bằng chữ, gắn `aria-describedby`). */
  unavailableReason?: { id: string; text: string };
  inputId?: string;
  /** Id thêm vào `aria-describedby` của radio (vd. lỗi của nhóm). */
  describedBy?: string;
}) {
  const describedByIds = [unavailableReason?.id, describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <label
      // Viền mặc định qua biến `--opt-line` (token `line`) để `has-[:checked]` đổi được sang primary (style inline sẽ đè class).
      className={`flex min-h-14 items-start gap-3 rounded-xl border border-[color:var(--opt-line)] p-3.5 transition-colors motion-reduce:transition-none has-[:checked]:border-[color:var(--color-primary)] has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-primary)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-primary)] ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
      style={{ ["--opt-line" as string]: LINE, background: disabled ? DISABLED_BG : undefined }}
    >
      <input
        id={inputId}
        type="radio"
        name="provider"
        value={option.id}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-describedby={describedByIds}
        className="mt-1 h-5 w-5 shrink-0 accent-[color:var(--color-primary)] disabled:opacity-50"
      />
      <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: disabled ? INK_SOFT : brandColors.primary }}>
        <ProviderIcon id={option.id} className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold" style={{ color: disabled ? INK_SOFT : INK }}>
          {option.label}
          {isCurrent ? <span className="ml-1.5 text-sm font-medium" style={{ color: INK_SOFT }}>(đang dùng)</span> : null}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed" style={{ color: INK_SOFT }}>
          {DESCRIPTION[option.id]}
        </span>
        {unavailableReason ? (
          <span id={unavailableReason.id} className="mt-1 block text-sm font-medium" style={{ color: INK }}>
            {unavailableReason.text}
          </span>
        ) : null}
      </span>
    </label>
  );
}

type Props = {
  tenantSlug: string;
  orderCode: string;
  /** Phương thức đang dùng; `null` = đơn chưa chọn → hiện danh sách + "Tiếp tục thanh toán". */
  current: { id: PaymentProviderId; label: string; confirmMode: "MANUAL" | "AUTO" } | null;
  options: CheckoutProviderOption[];
  canChange: boolean;
  totalVnd: number;
};

/**
 * Chọn / đổi cách thanh toán (ADR-062 §4.3, Q3/Q10). Radio gốc trong `fieldset/legend`, cả thẻ là `label` (≥56px). Phương
 * thức `available=false` (đã quá hạn giữ đơn của cách đó, tính từ lúc đặt đơn) bị vô hiệu và ghi lý do bằng chữ.
 * - Chưa chọn: nút "Tiếp tục thanh toán" ở cuối form (từ lg) và trên thanh dính đáy (mobile) — cùng một state.
 * - Đã chọn: thanh "Đang dùng … [Đổi]"; "Đổi" là nút disclosure (`aria-expanded`/`aria-controls`). Đổi xong → thu gọn, focus
 *   về tiêu đề khối thanh toán; câu thông báo đọc qua `CheckoutStatusAnnouncer` (đổi phương thức = đổi khoá trạng thái).
 */
export function PaymentMethodPanel({ tenantSlug, orderCode, current, options, canChange, totalVnd }: Props) {
  const uid = useId();
  const formId = `${uid}-form`;
  const listId = `${uid}-list`;
  const errorId = `${uid}-error`;
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const action = selectProviderAction.bind(null, tenantSlug, orderCode);

  // Thành công: thu gọn danh sách; `CheckoutPoll` đưa focus tới tiêu đề khối thanh toán vừa hiện/được làm mới.
  const [state, formAction, isPending] = useActionState(async (prev: CheckoutActionState, formData: FormData): Promise<CheckoutActionState> => {
    requestFocusAfterUpdate(PAYMENT_HEADING_ID);
    let result: CheckoutActionState;
    try {
      result = await action(prev, formData);
    } catch {
      result = { error: GENERIC_ERROR };
    }
    if (result.ok) setOpen(false);
    else clearFocusIntent();
    return result;
  }, {});

  const available = options.filter((o) => o.available);
  const selectable = current ? available.filter((o) => o.id !== current.id) : available;
  const defaultId = selectable[0]?.id;

  const optionList = (
    <fieldset className="space-y-2.5" aria-describedby={state.error ? errorId : undefined}>
      <legend className={current ? "sr-only" : "mb-3 font-[family-name:var(--font-heading)] text-xl font-bold"}>
        {current ? "Chọn cách thanh toán khác" : "Cách thanh toán"}
      </legend>
      {options.map((option) => {
        const isCurrent = current?.id === option.id;
        const disabled = !option.available || isCurrent;
        return (
          <ProviderOptionCard
            key={option.id}
            option={option}
            defaultChecked={option.id === defaultId}
            disabled={disabled}
            isCurrent={isCurrent}
            unavailableReason={
              !option.available
                ? { id: `${uid}-${option.id}-reason`, text: "Không dùng được: đơn đã quá thời hạn giữ của cách này (tính từ lúc đặt đơn)." }
                : undefined
            }
          />
        );
      })}
    </fieldset>
  );

  const errorText = state.error ? (
    <p id={errorId} role="alert" className="text-sm font-medium" style={{ color: ERROR_RED }}>
      {state.error}
    </p>
  ) : null;

  // ── Chưa chọn phương thức ──
  if (!current) {
    const nothing = available.length === 0;
    const submitLabel = isPending ? "Đang tạo thông tin thanh toán..." : "Tiếp tục thanh toán";
    return (
      <form id={formId} action={formAction} className="space-y-4">
        {optionList}
        {nothing ? (
          <p className="text-sm leading-relaxed" style={{ color: INK }}>
            Hiện chưa có cách thanh toán nào dùng được cho đơn này. Vui lòng quay lại sau.
          </p>
        ) : null}
        {errorText}
        <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
          Bấm “Tiếp tục thanh toán” để nhận mã QR và thông tin chuyển khoản. Bạn vẫn đổi được cách thanh toán khi chưa chuyển tiền.
        </p>
        <div className="hidden lg:block">
          <button type="submit" disabled={isPending || nothing} aria-busy={isPending || undefined} className={`${PRIMARY_BTN} w-full`} style={{ background: "var(--color-primary)" }}>
            {submitLabel}
          </button>
        </div>
        <MobileActionBar totalVnd={totalVnd}>
          <button type="submit" disabled={isPending || nothing} aria-busy={isPending || undefined} className={`${PRIMARY_BTN} w-full max-w-64 px-4 text-[15px]`} style={{ background: "var(--color-primary)" }}>
            {isPending ? "Đang tạo..." : "Tiếp tục thanh toán"}
          </button>
        </MobileActionBar>
      </form>
    );
  }

  // ── Đã chọn: thanh phương thức đang dùng + "Đổi" ──
  return (
    <section aria-labelledby={`${uid}-heading`} className="rounded-2xl border p-4" style={{ borderColor: LINE }}>
      <h2 id={`${uid}-heading`} className="sr-only">
        Cách thanh toán
      </h2>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: brandColors.surface, color: brandColors.primary }}>
          <ProviderIcon id={current.id} className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 leading-snug">
          <span className="block text-xs" style={{ color: INK_SOFT }}>
            Cách thanh toán
          </span>
          <span className="font-semibold [overflow-wrap:anywhere]">{current.label}</span>
        </p>
        {canChange ? (
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
            className={`${GHOST_BTN} shrink-0 px-4`}
            style={{ borderColor: LINE, color: brandColors.primary }}
          >
            {open ? "Đóng" : "Đổi"}
            <span className="sr-only"> cách thanh toán</span>
          </button>
        ) : null}
      </div>

      {canChange ? (
        <div id={listId} hidden={!open} className="mt-4 border-t pt-4" style={{ borderColor: LINE }}>
          <form action={formAction} className="space-y-4">
            {current.confirmMode === "MANUAL" ? (
              <div className="flex gap-2.5 rounded-xl border border-l-4 p-3.5 text-sm leading-relaxed" style={{ background: brandColors.accentSoft, borderColor: brandColors.accent, color: INK }}>
                <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Nếu bạn <strong className="font-semibold">đã chuyển tiền</strong> theo cách hiện tại, đừng đổi — hãy bấm “Tôi đã chuyển khoản”.
                </p>
              </div>
            ) : null}
            {optionList}
            {errorText}
            {selectable.length === 0 ? (
              <p className="text-sm" style={{ color: INK }}>
                Không còn cách thanh toán nào khác dùng được cho đơn này.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isPending || selectable.length === 0}
                aria-busy={isPending || undefined}
                className={`${PRIMARY_BTN} min-h-11 text-sm`}
                style={{ background: "var(--color-primary)" }}
              >
                {isPending ? "Đang đổi..." : "Dùng cách này"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  toggleRef.current?.focus();
                }}
                disabled={isPending}
                className={GHOST_BTN}
                style={{ borderColor: LINE, color: INK }}
              >
                Giữ cách hiện tại
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
