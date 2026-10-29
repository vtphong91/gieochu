"use client";

import { useActionState, useState, useTransition } from "react";
import { saveCloudinaryConfigAction, testCloudinaryConnectionAction, type CloudinaryActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, GhostButton, PasswordField, PrimaryButton, TextField, Toggle } from "../../_ui/kit";
import { IconDatabase } from "../../_ui/icons";
import { useFormDraft } from "../../_ui/use-form-draft";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";

const initialState: CloudinaryActionState = {};
const FIELDS = ["isEnabled", "cloudName", "uploadFolder"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ key/secret đã lưu. */
const SECRET_FIELDS = ["apiKey", "apiSecret"] as const;

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
  // Task 1.12b: lưu lỗi giữ giá trị đã nhập (trừ API key/secret) + cảnh báo rời trang. Form dựng lại theo dữ liệu server
  // sau khi lưu (key) để Toggle khớp trạng thái thật — kể cả khi bị tự tắt; `lastVerifiedAt` không vào key (bấm "Kiểm tra
  // kết nối" không xoá dữ liệu đang gõ).
  const saved = { isEnabled: initial.isEnabled, cloudName: initial.cloudName, uploadFolder: initial.uploadFolder || "gieochu" };
  const formKey = JSON.stringify({ ...initial, lastVerifiedAt: null });
  const { dirty, formProps } = useFormDraft({ names: FIELDS, secretNames: SECRET_FIELDS, initial: saved, resetKey: formKey, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Cấu hình Cloudinary có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  return (
    <form key={formKey} action={formAction} {...formProps}>
      <ConfigCard
        icon={<IconDatabase className="h-5 w-5" />}
        title="Cloudinary (upload ảnh CMS)"
        badges={
          <>
            <Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>
            {initial.lastVerifiedAt ? <Badge tone="info">Đã xác minh</Badge> : null}
            {dirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
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
          autoComplete="off"
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
