"use client";

import { useActionState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { createShareLinkAction, type ShareLinkActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, TextField } from "../../../../../admin/_ui/kit";
import { IconLinkChain } from "../../../../../_ui/editor/toolbar-icons";
import { useFormDraft } from "../../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../../admin/_ui/unsaved-changes";

const initialState: ShareLinkActionState = {};

export interface FileOption {
  id: string;
  fileName: string;
}

/** Mật khẩu link không bao giờ được ghi lại vào ô sau khi tạo lỗi (cùng quy tắc secret của `useFormDraft`). */
const FIELDS = ["label", "expiresAt", "maxUses", "fileIds"] as const;
const SECRET_FIELDS = ["password"] as const;

/**
 * Task 2.3b (ADR-058): tạo lỗi giữ giá trị đã nhập (trừ mật khẩu) + cảnh báo rời trang khi đang nhập dở. Tạo xong → form
 * được thay bằng khung hiện link (hết "đang nhập dở", không cảnh báo nữa).
 */
export function ShareLinkForm({ tenantSlug, productId, files, appUrl }: { tenantSlug: string; productId: string; files: FileOption[]; appUrl: string }) {
  const action = createShareLinkAction.bind(null, tenantSlug, productId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { dirty, formProps } = useFormDraft({
    names: FIELDS,
    secretNames: SECRET_FIELDS,
    // 1 file → ô checkbox đơn (boolean); ≥ 2 file → nhóm cùng tên (chuỗi các id đang tích); 0 file → không có ô.
    initial: { label: "", expiresAt: "", maxUses: "", fileIds: files.length === 1 ? false : "" },
    resetKey: productId,
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty && !state.createdToken, "Link chia sẻ đang nhập dở chưa được tạo. Rời trang và bỏ thay đổi?");

  if (state.createdToken) {
    const url = `${appUrl}/s/${state.createdToken}`;
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
        <p className="font-semibold" style={{ color: "#166534" }}>
          Đã tạo link — chỉ hiển thị một lần, hãy sao chép ngay:
        </p>
        <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{url}</code>
      </div>
    );
  }

  return (
    <form action={formAction} {...formProps}>
      <ConfigCard
        icon={<IconLinkChain className="h-5 w-5" />}
        title="Tạo link chia sẻ"
        badges={dirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : undefined}
        description="Link tải riêng cho 1 người, không cần đăng nhập."
      >
        <TextField id="label" label="Nhãn" name="label" required placeholder="Gửi cho anh Nam" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="expiresAt" label="Hết hạn (tuỳ chọn)" name="expiresAt" type="datetime-local" />
          <TextField id="maxUses" label="Số lượt tối đa (tuỳ chọn)" name="maxUses" type="number" min={1} />
        </div>
        <TextField id="password" label="Mật khẩu (tuỳ chọn)" name="password" type="text" />
        {/* Nhóm checkbox có tên nhóm cho trình đọc màn hình (fieldset/legend); mỗi dòng ≥ 44px dưới lg. */}
        <fieldset>
          <legend className="text-sm font-medium" style={{ color: brandColors.ink }}>
            File (bỏ trống = tất cả file bán)
          </legend>
          <div className="mt-1.5 space-y-1">
            {files.map((file) => (
              <label key={file.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm [overflow-wrap:anywhere] lg:min-h-8" style={{ color: brandColors.ink }}>
                <input type="checkbox" name="fileIds" value={file.id} className="h-4 w-4 shrink-0" />
                {file.fileName}
              </label>
            ))}
          </div>
        </fieldset>

        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang tạo..." : "Tạo link"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
