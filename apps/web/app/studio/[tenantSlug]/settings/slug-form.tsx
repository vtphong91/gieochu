"use client";

import { useActionState } from "react";
import { changeSlugAction, type SettingsActionState } from "./actions";
import { ConfigCard, FormBanner, GhostButton } from "../../../admin/_ui/kit";
import { IconGlobe } from "../../../admin/_ui/icons";
import { useFormDraft } from "../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../admin/_ui/unsaved-changes";

const initialState: SettingsActionState = {};

export function SlugForm({ tenantSlug }: { tenantSlug: string }) {
  const action = changeSlugAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  // Task 2.1: đổi lỗi (trùng, quá hạn 30 ngày…) không mất đường dẫn vừa gõ; thành công thì action chuyển trang.
  const { dirty, formProps } = useFormDraft({ names: ["newSlug"], initial: { newSlug: "" }, resetKey: tenantSlug, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Đường dẫn mới chưa được đổi. Rời trang và bỏ thay đổi?");

  return (
    <form action={formAction} {...formProps}>
      <ConfigCard
        icon={<IconGlobe className="h-5 w-5" />}
        title="Đường dẫn trang"
        description={`Hiện tại: /${tenantSlug}. Chỉ đổi được tối đa 1 lần / 30 ngày; đường dẫn cũ sẽ tự chuyển hướng sang đường dẫn mới.`}
      >
        <div className="flex gap-2.5">
          <input
            name="newSlug"
            aria-label="Đường dẫn mới"
            placeholder="duong-dan-moi"
            className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "#E5E7EB" }}
          />
          <GhostButton type="submit" disabled={isPending}>
            {isPending ? "Đang đổi..." : "Đổi"}
          </GhostButton>
        </div>
        <FormBanner ok={false} message={state.error} />
      </ConfigCard>
    </form>
  );
}
