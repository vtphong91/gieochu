"use client";

import { useActionState } from "react";
import { createShareLinkAction, type ShareLinkActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, TextField } from "../../../../../admin/_ui/kit";
import { IconLinkChain } from "../../../../../_ui/editor/toolbar-icons";

const initialState: ShareLinkActionState = {};

export interface FileOption {
  id: string;
  fileName: string;
}

export function ShareLinkForm({ tenantSlug, productId, files, appUrl }: { tenantSlug: string; productId: string; files: FileOption[]; appUrl: string }) {
  const action = createShareLinkAction.bind(null, tenantSlug, productId);
  const [state, formAction, isPending] = useActionState(action, initialState);

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
    <form action={formAction}>
      <ConfigCard icon={<IconLinkChain className="h-5 w-5" />} title="Tạo link chia sẻ" description="Link tải riêng cho 1 người, không cần đăng nhập.">
        <TextField id="label" label="Nhãn" name="label" required placeholder="Gửi cho anh Nam" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="expiresAt" label="Hết hạn (tuỳ chọn)" name="expiresAt" type="datetime-local" />
          <TextField id="maxUses" label="Số lượt tối đa (tuỳ chọn)" name="maxUses" type="number" min={1} />
        </div>
        <TextField id="password" label="Mật khẩu (tuỳ chọn)" name="password" type="text" />
        <div>
          <p className="text-sm font-medium" style={{ color: "#12213A" }}>
            File (bỏ trống = tất cả file bán)
          </p>
          <div className="mt-1.5 space-y-1.5">
            {files.map((file) => (
              <label key={file.id} className="flex items-center gap-2 text-sm" style={{ color: "#12213A" }}>
                <input type="checkbox" name="fileIds" value={file.id} className="h-4 w-4" />
                {file.fileName}
              </label>
            ))}
          </div>
        </div>

        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang tạo..." : "Tạo link"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
