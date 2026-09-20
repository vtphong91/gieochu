"use client";

import { useActionState, useState, useTransition } from "react";
import { saveCloudinaryConfigAction, testCloudinaryConnectionAction, type CloudinaryActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, GhostButton, PasswordField, PrimaryButton, TextField, Toggle } from "../../_ui/kit";
import { IconDatabase } from "../../_ui/icons";

const initialState: CloudinaryActionState = {};

export interface CloudinaryFormInitial {
  cloudName: string;
  uploadFolder: string;
  isEnabled: boolean;
  maskedApiKey?: string;
  maskedApiSecret?: string;
  lastVerifiedAt: string | null;
}

export function CloudinaryForm({ initial }: { initial: CloudinaryFormInitial }) {
  const [state, formAction, isPending] = useActionState(saveCloudinaryConfigAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();

  return (
    <form action={formAction}>
      <ConfigCard
        icon={<IconDatabase className="h-5 w-5" />}
        title="Cloudinary (upload ảnh CMS)"
        badges={
          <>
            <Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>
            {initial.lastVerifiedAt ? <Badge tone="info">Đã xác minh</Badge> : null}
          </>
        }
        description={
          initial.lastVerifiedAt
            ? `Đã kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.`
            : "Dùng riêng cho upload ảnh trong Landing Page CMS — khác với Lưu trữ file (R2, dùng cho tài liệu bán và ảnh bìa sản phẩm)."
        }
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
        footer={
          <p className="text-xs" style={{ color: "#B45309" }}>
            Đổi cloud name/API key/secret sẽ tự tắt kết nối này — lưu lại lần nữa (đã tích &quot;Bật&quot;) hoặc bấm &quot;Kiểm tra kết nối&quot; để xác nhận.
          </p>
        }
      >
        <TextField id="cloudinary-cloudName" label="Cloud name" name="cloudName" defaultValue={initial.cloudName} required />
        <TextField
          id="cloudinary-uploadFolder"
          label="Thư mục upload"
          name="uploadFolder"
          defaultValue={initial.uploadFolder || "gieochu"}
          hint="Ảnh CMS sẽ được lưu trong thư mục này trên Cloudinary."
          required
        />
        <PasswordField
          id="cloudinary-apiKey"
          label="API Key"
          name="apiKey"
          placeholder={initial.maskedApiKey ? `Hiện tại: ${initial.maskedApiKey} — để trống nếu giữ nguyên` : undefined}
        />
        <PasswordField
          id="cloudinary-apiSecret"
          label="API Secret"
          name="apiSecret"
          placeholder={initial.maskedApiSecret ? `Hiện tại: ${initial.maskedApiSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <div className="flex flex-wrap gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
          <GhostButton
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const result = await testCloudinaryConnectionAction();
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
