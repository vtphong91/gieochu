"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
// Subpath (không qua barrel "@gieochu/core") — barrel kéo theo code server-only, vỡ bundle client.
import type { SystemSettingKey, SystemSettingsValues, SYSTEM_SETTINGS_BOUNDS } from "@gieochu/core/system-settings";
import { ConfigCard, FormBanner, GhostButton, PrimaryButton, TextField } from "../../_ui/kit";
import { IconPackage, IconShield } from "../../_ui/icons";
import { updateSystemSettingsAction } from "./actions";

type ActionState = Awaited<ReturnType<typeof updateSystemSettingsAction>>;
type Bounds = typeof SYSTEM_SETTINGS_BOUNDS;

const initialState: ActionState = { ok: false };
const vnd = new Intl.NumberFormat("vi-VN");

/** Nhóm hiển thị (ADR-032 mục 3). Khoá mới chưa xếp nhóm sẽ rơi vào nhóm cuối — không bị mất khỏi form. */
const GROUPS: { id: string; title: string; description: string; icon: ReactNode; keys: SystemSettingKey[] }[] = [
  {
    id: "security",
    title: "Bảo mật & phiên",
    description: "Thời hạn phiên đăng nhập, liên kết gửi qua email và URL tải tệp có chữ ký.",
    icon: <IconShield className="h-5 w-5" />,
    keys: [
      "accessTokenTtlMinutes",
      "refreshTokenTtlDays",
      "emailVerifyTtlHours",
      "passwordResetTtlMinutes",
      "presignUploadTtlSeconds",
      "presignDownloadTtlSeconds",
    ],
  },
  {
    id: "business",
    title: "Nghiệp vụ",
    description: "Ân hạn gói, thời gian giữ đơn/hoá đơn chờ thanh toán và lượt tải mặc định cho tài liệu mới.",
    icon: <IconPackage className="h-5 w-5" />,
    keys: ["graceDays", "orderPendingTtlMinutes", "invoicePendingTtlHours", "defaultDownloadLimit", "trialDays"],
  },
];

/** Giải thích ngắn từng khoá cho System Admin (nhãn + đơn vị lấy từ `bounds`). */
const DESCRIPTIONS: Partial<Record<SystemSettingKey, string>> = {
  accessTokenTtlMinutes: "Phiên đăng nhập tự làm mới sau khoảng này.",
  refreshTokenTtlDays: "Không hoạt động quá thời hạn này phải đăng nhập lại.",
  emailVerifyTtlHours: "Liên kết kích hoạt tài khoản gửi qua email.",
  passwordResetTtlMinutes: "Liên kết đặt lại mật khẩu gửi qua email.",
  presignUploadTtlSeconds: "URL tải tệp lên kho lưu trữ.",
  presignDownloadTtlSeconds: "URL tải tài liệu của khách — tối đa 10 phút.",
  graceDays: "Gói hết hạn vẫn dùng được trong số ngày này.",
  orderPendingTtlMinutes: "Đơn chưa thanh toán tự huỷ sau khoảng này.",
  invoicePendingTtlHours: "Hoá đơn gói chưa thanh toán tự huỷ sau khoảng này.",
  defaultDownloadLimit: "Điền sẵn khi người bán tạo tài liệu mới. 0 = không giới hạn.",
};

function hintFor(key: SystemSettingKey, bounds: Bounds): string {
  const bound = bounds[key];
  const range = `Mặc định ${vnd.format(bound.default)} · Khoảng ${vnd.format(bound.min)}–${vnd.format(bound.max)} ${bound.unit}`;
  const description = DESCRIPTIONS[key];
  return description ? `${description} ${range}.` : `${range}.`;
}

function toStrings(values: SystemSettingsValues): Record<SystemSettingKey, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])) as Record<SystemSettingKey, string>;
}

/**
 * ADR-032 — form cấu hình chung (`/admin/settings/general`). Ô số có kiểm soát (controlled) để lưu lỗi không làm mất
 * giá trị đã gõ (React 19 tự reset ô không kiểm soát sau form action). Lưu lỗi có lỗi theo ô → hiện bảng tóm tắt lỗi
 * đầu form (focus vào đó, mỗi dòng là link tới ô) và giữ lỗi ngay dưới từng ô. Khoá `inactiveKeys` bị ẩn — action
 * không bắt buộc gửi (vắng = giữ giá trị cũ).
 */
export function GeneralSettingsForm({
  values,
  bounds,
  inactiveKeys,
}: {
  values: SystemSettingsValues;
  bounds: Bounds;
  inactiveKeys: SystemSettingKey[];
}) {
  const [state, formAction, isPending] = useActionState(updateSystemSettingsAction, initialState);
  const [fields, setFields] = useState<Record<SystemSettingKey, string>>(() => toStrings(values));
  const summaryRef = useRef<HTMLDivElement>(null);

  const hidden = new Set(inactiveKeys);
  const allKeys = Object.keys(bounds) as SystemSettingKey[];
  const grouped = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = GROUPS.map((group, index) => ({
    ...group,
    keys: [...group.keys, ...(index === GROUPS.length - 1 ? allKeys.filter((k) => !grouped.has(k)) : [])].filter((k) => !hidden.has(k)),
  })).filter((group) => group.keys.length > 0);
  const visibleKeys = groups.flatMap((g) => g.keys);

  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  const errorKeys = visibleKeys.filter((key) => fieldErrors[key]);
  // Lỗi của khoá đang ẩn (không có ô để hiện) → gộp vào thông báo chung.
  const hiddenErrors = (Object.keys(fieldErrors) as SystemSettingKey[]).filter((key) => hidden.has(key)).map((key) => fieldErrors[key]);

  // Sau lần lưu thất bại có lỗi theo ô: đưa focus tới bảng tóm tắt lỗi (bàn phím / trình đọc màn hình biết ngay).
  useEffect(() => {
    if (!state.ok && state.fieldErrors && Object.keys(state.fieldErrors).length > 0) summaryRef.current?.focus();
  }, [state]);

  const isDefault = visibleKeys.every((key) => fields[key] === String(bounds[key].default));

  return (
    <form action={formAction} noValidate className="mt-6 space-y-6">
      {errorKeys.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="settings-error-title"
          className="rounded-xl border px-4 py-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40"
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}
        >
          <h2 id="settings-error-title" className="font-semibold">
            Chưa lưu — {errorKeys.length} ô cần sửa
          </h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {errorKeys.map((key) => (
              <li key={key}>
                <a href={`#${key}`} className="underline underline-offset-2">
                  {fieldErrors[key]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {groups.map((group) => (
          <ConfigCard key={group.id} icon={group.icon} title={group.title} description={group.description}>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.keys.map((key) => {
                const bound = bounds[key];
                return (
                  <TextField
                    key={key}
                    id={key}
                    name={key}
                    label={`${bound.label} (${bound.unit})`}
                    type="number"
                    inputMode="numeric"
                    min={bound.min}
                    max={bound.max}
                    step={1}
                    required
                    value={fields[key]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    hint={hintFor(key, bounds)}
                    error={fieldErrors[key]}
                  />
                );
              })}
            </div>
          </ConfigCard>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" style={{ borderColor: "#E5E7EB" }}>
        <p className="text-sm" style={{ color: "#4B5563" }}>
          Thay đổi chỉ áp cho thao tác mới — phiên, liên kết, đơn và hoá đơn đã tạo giữ thời hạn cũ.
        </p>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
          <GhostButton
            type="button"
            disabled={isPending || isDefault}
            onClick={() => setFields((prev) => ({ ...prev, ...Object.fromEntries(visibleKeys.map((key) => [key, String(bounds[key].default)])) }))}
          >
            Điền giá trị mặc định
          </GhostButton>
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
        </div>
      </div>

      <div>
        {state.ok ? (
          <FormBanner ok message="Đã lưu cấu hình. Thay đổi áp dụng cho thao tác mới." />
        ) : state.error && errorKeys.length === 0 ? (
          <FormBanner ok={false} message={[state.error, ...hiddenErrors].filter(Boolean).join(" ")} />
        ) : null}
      </div>
    </form>
  );
}
