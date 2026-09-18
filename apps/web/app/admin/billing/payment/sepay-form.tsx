"use client";

import { useActionState } from "react";
import { saveSepayAction, type PlatformPaymentActionState } from "./actions";

const initialState: PlatformPaymentActionState = {};

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

export function SepayForm({
  banks,
  webhookUrl,
  initial,
}: {
  banks: BankOption[];
  webhookUrl: string;
  initial: {
    bankBin: string;
    accountNo: string;
    accountName: string;
    authType: string;
    paymentPrefix: string;
    isEnabled: boolean;
    maskedSecret?: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(saveSepayAction, initialState);

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">SePay (tài khoản Tani)</h2>
      <p className="mt-1 text-sm text-gray-500">
        Dán URL webhook này vào trang quản trị SePay: <code className="font-mono text-xs">{webhookUrl}</code>
      </p>
      <p className="mt-1 text-xs text-amber-600">
        Đổi số tài khoản hoặc secret sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
      </p>
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
        <input name="accountNo" defaultValue={initial.accountNo} placeholder="Số tài khoản" required className="w-full rounded border px-3 py-2" />
        <input name="accountName" defaultValue={initial.accountName} placeholder="Tên chủ tài khoản" required className="w-full rounded border px-3 py-2" />
        <input
          name="paymentPrefix"
          defaultValue={initial.paymentPrefix || "SUB"}
          placeholder="Tiền tố mã hoá đơn (mặc định SUB)"
          required
          maxLength={6}
          className="w-full rounded border px-3 py-2"
        />
        <select name="authType" defaultValue={initial.authType || "HMAC_SHA256"} className="w-full rounded border px-3 py-2">
          <option value="HMAC_SHA256">HMAC-SHA256 (khuyến nghị)</option>
          <option value="API_KEY">API Key</option>
        </select>
        <input
          name="secret"
          type="password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : "Secret / API key"}
          className="w-full rounded border px-3 py-2"
        />
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
        <button type="submit" disabled={isPending} className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50">
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
    </section>
  );
}
