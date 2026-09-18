"use client";

import { useActionState } from "react";
import { saveManualQrAction, type PaymentActionState } from "./actions";

const initialState: PaymentActionState = {};

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

export function ManualQrForm({
  tenantSlug,
  banks,
  initial,
}: {
  tenantSlug: string;
  banks: BankOption[];
  initial: { bankBin: string; accountNo: string; accountName: string; isEnabled: boolean };
}) {
  const action = saveManualQrAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">QR chuyển khoản thủ công</h2>
      <p className="mt-1 text-sm text-gray-500">Không có webhook — bạn tự xác nhận đơn đã thanh toán.</p>
      <form action={formAction} className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} />
          Bật phương thức này
        </label>
        <select name="bankBin" defaultValue={initial.bankBin} required className="w-full rounded border px-3 py-2">
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </select>
        <input
          name="accountNo"
          defaultValue={initial.accountNo}
          placeholder="Số tài khoản"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="accountName"
          defaultValue={initial.accountName}
          placeholder="Tên chủ tài khoản"
          required
          className="w-full rounded border px-3 py-2"
        />
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
    </section>
  );
}
