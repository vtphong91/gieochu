"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { normalizeAccountName, REFUND_PAYOUT_ACCOUNT_NAME_MAX, SUBSCRIPTION_REFUND_REASON_MAX } from "@gieochu/core/subscription-refund";
import { requestSubscriptionRefundAction, type RefundRequestActionState } from "./actions";
import { FormBanner, Notice, PrimaryButton, SelectField, TextField } from "../../../admin/_ui/kit";

const initialState: RefundRequestActionState = {};

export interface RefundBankOption {
  bin: string;
  label: string;
}

type PayoutField = "bankBin" | "accountNo" | "accountName";
const FIELD_ORDER: PayoutField[] = ["bankBin", "accountNo", "accountName"];
const FIELD_ID: Record<PayoutField, string> = { bankBin: "refund-bankBin", accountNo: "refund-accountNo", accountName: "refund-accountName" };

const INPUT_CLASS =
  "min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15";

/**
 * ADR-041 B (+ bổ sung) — form yêu cầu hoàn tiền gói. Chỉ gửi lý do + thông tin nhận tiền; hoá đơn/số tiền do server tự xác
 * định, thông tin nhận tiền mã hoá ở server, chỉ quản trị viên xem.
 *
 * Giữ giá trị khi lỗi mà không cần action trả lại `values`: có JS thì gửi qua `onSubmit` → gọi action trong transition
 * (không qua prop `action`, nên React không tự reset form — ô không bị xoá, kể cả số tài khoản). Không có JS vẫn gửi được qua
 * `action`. Lỗi từng ô hiện dưới ô (`aria-describedby`) và focus nhảy tới ô lỗi đầu tiên.
 */
export function RefundRequestForm({ tenantSlug, banks, amountLabel, deadlineLabel }: { tenantSlug: string; banks: RefundBankOption[]; amountLabel: string; deadlineLabel: string }) {
  const action = requestSubscriptionRefundAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstInvalid = FIELD_ORDER.find((field) => state.fieldErrors?.[field]);
    if (firstInvalid) document.getElementById(FIELD_ID[firstInvalid])?.focus();
    else if (state.error) bannerRef.current?.focus();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.success) {
    return <FormBanner ok message="Đã gửi yêu cầu hoàn tiền. Bạn sẽ nhận email khi quản trị viên xử lý xong." />;
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      <Notice tone="info">
        Bạn được hoàn <strong>{amountLabel}</strong> (100% lần thanh toán gói đầu tiên) nếu gửi yêu cầu trước <strong>{deadlineLabel}</strong>. Sau khi hoàn tiền, gian
        hàng chuyển về gói Miễn phí — dữ liệu được giữ nguyên. Mỗi gian hàng chỉ gửi yêu cầu một lần.
      </Notice>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Tài khoản nhận tiền hoàn</legend>
        <SelectField
          id={FIELD_ID.bankBin}
          label="Ngân hàng"
          name="bankBin"
          defaultValue=""
          required
          autoComplete="off"
          error={state.fieldErrors?.bankBin}
          className={INPUT_CLASS}
        >
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.label}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id={FIELD_ID.accountNo}
            label="Số tài khoản"
            name="accountNo"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={30}
            hint="6–19 chữ số, có thể gõ kèm dấu cách."
            error={state.fieldErrors?.accountNo}
            className={INPUT_CLASS}
          />
          <TextField
            id={FIELD_ID.accountName}
            label="Tên chủ tài khoản"
            name="accountName"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={REFUND_PAYOUT_ACCOUNT_NAME_MAX + 20}
            hint="Đúng tên trên tài khoản ngân hàng — tự chuyển sang chữ in hoa không dấu."
            error={state.fieldErrors?.accountName}
            className={INPUT_CLASS}
            onBlur={(event) => {
              event.currentTarget.value = normalizeAccountName(event.currentTarget.value);
            }}
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="refund-reason" className="block text-sm font-medium">
          Lý do (không bắt buộc)
        </label>
        <textarea
          id="refund-reason"
          name="reason"
          maxLength={SUBSCRIPTION_REFUND_REASON_MAX}
          rows={3}
          aria-describedby="refund-reason-hint"
          className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15"
          style={{ borderColor: "#E5E7EB" }}
        />
        <p id="refund-reason-hint" className="mt-1.5 text-xs text-gray-600">
          Tối đa {SUBSCRIPTION_REFUND_REASON_MAX} ký tự. Góp ý của bạn giúp chúng tôi cải thiện dịch vụ.
        </p>
      </div>

      <label htmlFor="refund-confirm" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed">
        <input id="refund-confirm" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-primary,#0F3B82)]" />
        <span>Tôi hiểu rằng khi được hoàn tiền, gian hàng sẽ chuyển về gói Miễn phí ngay và không gửi lại yêu cầu được lần nữa.</span>
      </label>

      <p className="text-xs text-gray-600">Thông tin tài khoản được mã hoá, chỉ quản trị viên xem để chuyển khoản và tự xoá sau khi yêu cầu được xử lý.</p>
      <div ref={bannerRef} tabIndex={-1} className="outline-none">
        <FormBanner ok={false} message={state.error} />
      </div>
      <PrimaryButton
        loading={isPending}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
      </PrimaryButton>
    </form>
  );
}
