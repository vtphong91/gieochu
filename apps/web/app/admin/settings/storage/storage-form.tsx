"use client";

import { useActionState, useState, useTransition } from "react";
import { saveStorageConfigAction, testStorageConnectionAction, type StorageActionState } from "./actions";

const initialState: StorageActionState = {};

export interface StorageFormInitial {
  endpoint: string;
  region: string;
  bucketPrivate: string;
  bucketPublic: string;
  publicBaseUrl: string;
  isEnabled: boolean;
  maskedAccessKeyId?: string;
  maskedSecretAccessKey?: string;
  lastVerifiedAt: string | null;
}

export function StorageForm({ initial }: { initial: StorageFormInitial }) {
  const [state, formAction, isPending] = useActionState(saveStorageConfigAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">Tài khoản lưu trữ file (S3-compatible — Cloudflare R2)</h2>
      <p className="mt-1 text-xs text-amber-600">
        Đổi endpoint/bucket/access key sẽ tự tắt kết nối này — lưu lại lần nữa (đã tích &quot;Bật&quot;) hoặc bấm
        &quot;Kiểm tra kết nối&quot; để xác nhận.
      </p>
      {initial.lastVerifiedAt ? (
        <p className="mt-1 text-xs text-green-700">Đã kiểm tra kết nối thành công lúc {initial.lastVerifiedAt}.</p>
      ) : null}
      <form action={formAction} className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} />
          Bật (dùng cho upload file thật)
        </label>
        <input
          name="endpoint"
          defaultValue={initial.endpoint}
          placeholder="Endpoint (https://<account-id>.r2.cloudflarestorage.com)"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input name="region" defaultValue={initial.region || "auto"} placeholder="Region" required className="w-full rounded border px-3 py-2" />
        <input
          name="bucketPrivate"
          defaultValue={initial.bucketPrivate}
          placeholder="Bucket private (file tài liệu)"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="bucketPublic"
          defaultValue={initial.bucketPublic}
          placeholder="Bucket public (ảnh bìa)"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="publicBaseUrl"
          defaultValue={initial.publicBaseUrl}
          placeholder="URL công khai của bucket public (VD: https://pub-xxxx.r2.dev)"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="accessKeyId"
          type="password"
          placeholder={initial.maskedAccessKeyId ? `Access Key ID hiện tại: ${initial.maskedAccessKeyId} — để trống nếu giữ nguyên` : "Access Key ID"}
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="secretAccessKey"
          type="password"
          placeholder={
            initial.maskedSecretAccessKey
              ? `Secret hiện tại: ${initial.maskedSecretAccessKey} — để trống nếu giữ nguyên`
              : "Secret Access Key"
          }
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
            const result = await testStorageConnectionAction();
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
