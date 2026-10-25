"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMomoAction, testMomoConnectionAction, type PlatformPaymentActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, GhostButton, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconWallet } from "../../_ui/icons";

const initialState: PlatformPaymentActionState = {};

export function MomoForm({
  initial,
}: {
  initial: { partnerCode: string; accessKey: string; environment: string; isEnabled: boolean; maskedSecret?: string; lastVerifiedAt: string | null };
}) {
  const [state, formAction, isPending] = useActionState(saveMomoAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();
  // `lastVerifiedAt` đổi khi bấm "Kiểm tra kết nối" — không đưa vào key để không xoá dữ liệu admin đang gõ dở.
  const formKey = JSON.stringify({ ...initial, lastVerifiedAt: null });

  return (
    // React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo
    // giá trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu.
    <form key={formKey} action={formAction}>
      <ConfigCard
        icon={<IconWallet className="h-5 w-5" />}
        title="MoMo"
        badges={
          <>
            <Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>
            {initial.lastVerifiedAt ? <Badge tone="info">Đã xác minh</Badge> : null}
          </>
        }
        description={initial.lastVerifiedAt ? `Đã kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.` : "Ví điện tử MoMo — xác nhận tự động qua API chính thức."}
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
        footer={
          <p className="text-xs" style={{ color: "#B45309" }}>
            Đổi partner code hoặc secret key sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
          </p>
        }
      >
        <TextField id="momo-partnerCode" label="Partner Code" name="partnerCode" defaultValue={initial.partnerCode} required />
        <TextField id="momo-accessKey" label="Access Key" name="accessKey" defaultValue={initial.accessKey} required />
        <SelectField id="momo-environment" label="Môi trường" name="environment" defaultValue={initial.environment || "sandbox"}>
          <option value="sandbox">Sandbox (thử nghiệm)</option>
          <option value="production">Production</option>
        </SelectField>
        <TextField
          id="momo-secretKey"
          label="Secret Key"
          name="secretKey"
          type="password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <div className="flex flex-wrap gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
          <GhostButton
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const result = await testMomoConnectionAction();
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
