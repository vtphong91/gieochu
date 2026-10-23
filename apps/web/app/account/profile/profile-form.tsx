"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { PROFILE_FULL_NAME_MAX_LENGTH, VN_PROVINCES } from "@gieochu/core/account-profile";
import { PrimaryButton, GhostButton, SelectField, TextField } from "../../admin/_ui/kit";
import { ResultBanner, useResultFocus } from "../_ui/form-feedback";
import { updateProfileAction } from "./actions";

interface ProfileValues {
  fullName: string;
  phone: string;
  province: string;
}

function readValues(form: HTMLFormElement): ProfileValues {
  const data = new FormData(form);
  const get = (name: keyof ProfileValues) => {
    const value = data.get(name);
    return typeof value === "string" ? value : "";
  };
  return { fullName: get("fullName"), phone: get("phone"), province: get("province") };
}

function sameValues(a: ProfileValues, b: ProfileValues): boolean {
  return a.fullName.trim() === b.fullName.trim() && a.phone.trim() === b.phone.trim() && a.province === b.province;
}

/**
 * ADR-041 C2 — form "Thông tin cá nhân" (`useActionState`). Lỗi theo ô dưới từng ô (`aria-describedby` do kit gắn),
 * giữ giá trị đã gõ qua `values` khi lỗi; lỗi chung/thành công ở banner nhận focus. "Lưu thay đổi" là nút chính duy
 * nhất, chỉ bật khi form khác giá trị đã lưu; "Hoàn tác" trả form về giá trị đã lưu (không điều hướng).
 */
export function ProfileForm({ saved }: { saved: ProfileValues }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, null);
  // "Hoàn tác" bỏ qua state lỗi hiện tại (giá trị đã gõ) để form về giá trị đã lưu; lần gửi sau state mới lại hiện.
  const [dismissed, setDismissed] = useState<typeof state>(null);
  const [resetCount, setResetCount] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  useResultFocus(state, formRef, bannerRef);

  const active = state && state !== dismissed ? state : null;
  const failed = active && !active.ok ? active : null;
  const initial: ProfileValues = failed?.values
    ? { fullName: failed.values.fullName ?? "", phone: failed.values.phone ?? "", province: failed.values.province ?? "" }
    : saved;
  const errors = failed?.fieldErrors ?? {};
  // Remount ô nhập khi: lưu xong (giá trị mới từ server), lỗi trả về (giá trị đã gõ), hoặc bấm Hoàn tác.
  const formKey = `${active?.ok ? "saved" : failed ? "failed" : "idle"}-${resetCount}-${saved.fullName}|${saved.phone}|${saved.province}`;

  return (
    // Card fluid theo lưới trang → giới hạn chiều rộng *form* (max-w-3xl), không giới hạn khung trang. `@container`:
    // SĐT + Tỉnh/Thành chia 2 cột theo bề rộng thật của form (cột lưới/sidebar), không theo viewport.
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="@container max-w-3xl space-y-5"
    >
      <ResultBanner state={active} bannerRef={bannerRef} />
      <ProfileFields key={formKey} initial={initial} saved={saved} errors={errors} pending={pending} onUndo={() => {
        setDismissed(state);
        setResetCount((n) => n + 1);
      }} />
    </form>
  );
}

function ProfileFields({
  initial,
  saved,
  errors,
  pending,
  onUndo,
}: {
  initial: ProfileValues;
  saved: ProfileValues;
  errors: Record<string, string>;
  pending: boolean;
  onUndo: () => void;
}) {
  const [dirty, setDirty] = useState(() => !sameValues(initial, saved));
  // Giá trị cũ nhập tự do (trước ADR-041) không có trong danh sách → vẫn hiện để không mất dữ liệu.
  const legacyProvince = initial.province && !(VN_PROVINCES as readonly string[]).includes(initial.province) ? initial.province : null;

  function handleChange(event: FormEvent<HTMLDivElement>) {
    const form = (event.currentTarget as HTMLElement).closest("form");
    if (form) setDirty(!sameValues(readValues(form), saved));
  }

  return (
    <div className="space-y-5" onChange={handleChange}>
      <p id="profile-required-note" className="text-xs text-gray-600">
        Ô có dấu <span aria-hidden="true">*</span>
        <span className="sr-only">sao</span> là bắt buộc.
      </p>
      <TextField
        id="fullName"
        name="fullName"
        label="Họ và tên *"
        autoComplete="name"
        defaultValue={initial.fullName}
        required
        aria-required="true"
        maxLength={PROFILE_FULL_NAME_MAX_LENGTH}
        hint="Tên hiển thị trong tài khoản và email gửi cho bạn."
        error={errors.fullName}
      />
      <div className="grid gap-5 @xl:grid-cols-2">
        <TextField
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          label="Số điện thoại (tuỳ chọn)"
          defaultValue={initial.phone}
          hint="10 số, bắt đầu bằng 0 hoặc +84. Chỉ bạn và quản trị hệ thống thấy — gian hàng không thấy."
          error={errors.phone}
        />
        <SelectField
          id="province"
          name="province"
          label="Tỉnh / Thành phố (tuỳ chọn)"
          defaultValue={initial.province}
          hint="Chỉ bạn và quản trị hệ thống thấy."
          error={errors.province}
        >
          <option value="">— Chưa chọn —</option>
          {legacyProvince ? <option value={legacyProvince}>{legacyProvince} (đã lưu trước đây)</option> : null}
          {VN_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end" style={{ borderColor: "#E5E7EB" }}>
        <GhostButton type="button" onClick={onUndo} disabled={!dirty || pending}>
          Hoàn tác
        </GhostButton>
        <PrimaryButton loading={pending} disabled={!dirty || pending}>
          {pending ? "Đang lưu…" : "Lưu thay đổi"}
        </PrimaryButton>
      </div>
      {!dirty && !pending ? (
        <p className="text-xs text-gray-600 sm:text-right">
          Chưa có thay đổi để lưu.
        </p>
      ) : null}
    </div>
  );
}
