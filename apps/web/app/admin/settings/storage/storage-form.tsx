"use client";

import { useActionState, useState, useTransition } from "react";
import { saveStorageConfigAction, testStorageConnectionAction, type StorageActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, GhostButton, PrimaryButton, TextField, Toggle } from "../../_ui/kit";
import { IconDatabase } from "../../_ui/icons";

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
    <form action={formAction}>
      <ConfigCard
        icon={<IconDatabase className="h-5 w-5" />}
        title="S3-compatible (Cloudflare R2)"
        badges={
          <>
            <Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>
            {initial.lastVerifiedAt ? <Badge tone="info">Đã xác minh</Badge> : null}
          </>
        }
        description={initial.lastVerifiedAt ? `Đã kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.` : "Lưu file tài liệu (bucket private) và ảnh bìa (bucket public) của toàn nền tảng."}
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
        footer={
          <p className="text-xs" style={{ color: "#B45309" }}>
            Đổi endpoint/bucket/access key sẽ tự tắt kết nối này — lưu lại lần nữa (đã tích &quot;Bật&quot;) hoặc bấm &quot;Kiểm tra kết nối&quot; để xác nhận.
          </p>
        }
      >
        <TextField id="storage-endpoint" label="Endpoint" name="endpoint" defaultValue={initial.endpoint} placeholder="https://<account-id>.r2.cloudflarestorage.com" required />
        <TextField id="storage-region" label="Region" name="region" defaultValue={initial.region || "auto"} required />
        <TextField id="storage-bucketPrivate" label="Bucket private (file tài liệu)" name="bucketPrivate" defaultValue={initial.bucketPrivate} required />
        <TextField id="storage-bucketPublic" label="Bucket public (ảnh bìa)" name="bucketPublic" defaultValue={initial.bucketPublic} required />
        <TextField
          id="storage-publicBaseUrl"
          label="URL công khai của bucket public"
          name="publicBaseUrl"
          defaultValue={initial.publicBaseUrl}
          placeholder="https://pub-xxxx.r2.dev"
        />
        <TextField
          id="storage-accessKeyId"
          label="Access Key ID"
          name="accessKeyId"
          type="password"
          placeholder={initial.maskedAccessKeyId ? `Hiện tại: ${initial.maskedAccessKeyId} — để trống nếu giữ nguyên` : undefined}
        />
        <TextField
          id="storage-secretAccessKey"
          label="Secret Access Key"
          name="secretAccessKey"
          type="password"
          placeholder={initial.maskedSecretAccessKey ? `Hiện tại: ${initial.maskedSecretAccessKey} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <div className="flex flex-wrap gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
          <GhostButton
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const result = await testStorageConnectionAction();
                setTestResult(result.testResult ?? null);
              })
            }
          >
            {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </GhostButton>
        </div>
        {testResult ? <FormBanner ok={testResult.ok} message={testResult.ok ? "Kết nối thành công." : (testResult.message ?? "Kết nối thất bại.")} /> : null}
      </ConfigCard>
    </form>
  );
}
