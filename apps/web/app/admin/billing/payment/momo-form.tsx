"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMomoAction, testMomoConnectionAction, type PlatformPaymentActionState } from "./actions";

const initialState: PlatformPaymentActionState = {};

export function MomoForm({
  initial,
}: {
  initial: { partnerCode: string; accessKey: string; environment: string; isEnabled: boolean; maskedSecret?: string; lastVerifiedAt: string | null };
}) {
  const [state, formAction, isPending] = useActionState(saveMomoAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">MoMo (tài khoản Tani)</h2>
      <p className="mt-1 text-xs text-amber-600">
        Đổi partner code hoặc secret key sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
      </p>
      {initial.lastVerifiedAt ? (
        <p className="mt-1 text-xs text-green-700">Đã kiểm tra kết nối thành công lúc {initial.lastVerifiedAt}.</p>
      ) : null}
      <form action={formAction} className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} />
          Bật phương thức này
        </label>
        <input name="partnerCode" defaultValue={initial.partnerCode} placeholder="Partner Code" required className="w-full rounded border px-3 py-2" />
        <input name="accessKey" defaultValue={initial.accessKey} placeholder="Access Key" required className="w-full rounded border px-3 py-2" />
        <select name="environment" defaultValue={initial.environment || "sandbox"} className="w-full rounded border px-3 py-2">
          <option value="sandbox">Sandbox (thử nghiệm)</option>
          <option value="production">Production</option>
        </select>
        <input
          name="secretKey"
          type="password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : "Secret Key"}
          className="w-full rounded border px-3 py-2"
        />
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
        <button type="submit" disabled={isPending} className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50">
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
      <button
        type="button"
        disabled={isTesting}
        onClick={() =>
          startTest(async () => {
            const result = await testMomoConnectionAction();
            setTestResult(result.testResult ?? null);
          })
        }
        className="mt-3 rounded border px-4 py-2 text-sm disabled:opacity-50"
      >
        {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
      </button>
      {testResult ? (
        <p className={`mt-2 text-sm ${testResult.ok ? "text-green-700" : "text-red-600"}`}>
          {testResult.ok ? "Kết nối thành công." : (testResult.message ?? "Kết nối thất bại.")}
        </p>
      ) : null}
    </section>
  );
}
