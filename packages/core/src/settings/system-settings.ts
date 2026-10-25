import { z } from "zod";

/**
 * ADR-032 mục 3 — cấu hình hệ thống do System Admin quản lý ở System Center
 * (`/admin/settings/general`, bảng L1 `system_settings`, 1 dòng `id="default"`).
 * File này là nguồn duy nhất của mặc định + giới hạn; dùng chung cho validate
 * lúc ghi (Server Action) và parse phòng thủ lúc đọc (dòng thiếu/hỏng → mặc định).
 *
 * Module thuần (chỉ zod) — client component import được qua subpath
 * `@gieochu/core/system-settings` để hiển thị giới hạn trên form.
 */

/** Múi giờ hiển thị — hằng trong code, không cấu hình (ADR-032 mục 4, CLAUDE.md "Quy ước code"). */
export const DISPLAY_TIME_ZONE = "Asia/Ho_Chi_Minh";

export interface SystemSettingBound {
  default: number;
  min: number;
  max: number;
  /** Nhãn tiếng Việt ngắn — dùng trong thông báo lỗi. */
  label: string;
  unit: string;
}

export const SYSTEM_SETTINGS_BOUNDS = {
  accessTokenTtlMinutes: { default: 15, min: 5, max: 60, label: "Thời hạn access token", unit: "phút" },
  refreshTokenTtlDays: { default: 7, min: 1, max: 30, label: "Thời hạn refresh token", unit: "ngày" },
  emailVerifyTtlHours: { default: 24, min: 1, max: 72, label: "Hạn link xác minh email", unit: "giờ" },
  passwordResetTtlMinutes: { default: 30, min: 10, max: 120, label: "Hạn link đặt lại mật khẩu", unit: "phút" },
  presignUploadTtlSeconds: { default: 600, min: 60, max: 3600, label: "Hạn URL tải lên", unit: "giây" },
  /** §7.6: URL tải xuống presigned sống ≤ 10 phút — trần 600 còn được kẹp lại ở chỗ ký (packages/storage). */
  presignDownloadTtlSeconds: { default: 600, min: 60, max: 600, label: "Hạn URL tải xuống", unit: "giây" },
  trialDays: { default: 14, min: 0, max: 60, label: "Số ngày dùng thử", unit: "ngày" },
  graceDays: { default: 7, min: 0, max: 30, label: "Số ngày ân hạn", unit: "ngày" },
  orderPendingTtlMinutes: { default: 60, min: 15, max: 1440, label: "Hạn đơn chờ thanh toán", unit: "phút" },
  invoicePendingTtlHours: { default: 24, min: 1, max: 168, label: "Hạn hoá đơn chờ thanh toán", unit: "giờ" },
  /** 0 = không giới hạn (cùng quy ước `Product.downloadLimit`, ADR-014). */
  defaultDownloadLimit: { default: 5, min: 0, max: 1000, label: "Lượt tải mặc định", unit: "lượt" },
  /** ADR-053 chính sách phiên. Idle tối thiểu 10 phút: phải lớn hơn chu kỳ làm mới phía client (≤ idle/3). */
  sessionIdleMinutes: { default: 60, min: 10, max: 1440, label: "Tự đăng xuất khi không thao tác", unit: "phút" },
  sessionAbsoluteHours: { default: 12, min: 1, max: 72, label: "Thời hạn tối đa một phiên", unit: "giờ" },
  /** Trần 30 ngày (NIST SP 800-63B AAL1). */
  rememberMeDays: { default: 30, min: 1, max: 30, label: "Thời hạn \"Ghi nhớ đăng nhập\"", unit: "ngày" },
  adminIdleMinutes: { default: 15, min: 10, max: 60, label: "Tự đăng xuất quản trị viên khi không thao tác", unit: "phút" },
  adminAbsoluteHours: { default: 8, min: 1, max: 24, label: "Thời hạn tối đa phiên quản trị viên", unit: "giờ" },
  sessionWarningMinutes: { default: 2, min: 1, max: 10, label: "Cảnh báo trước khi tự đăng xuất", unit: "phút" },
} as const satisfies Record<string, SystemSettingBound>;

export type SystemSettingKey = keyof typeof SYSTEM_SETTINGS_BOUNDS;
export type SystemSettingsValues = Record<SystemSettingKey, number>;

export const SYSTEM_SETTING_KEYS = Object.keys(SYSTEM_SETTINGS_BOUNDS) as SystemSettingKey[];

/**
 * Khoá được lưu + validate nhưng CHƯA có nghiệp vụ nào dùng — UI ẩn đi; Server Action không bắt buộc
 * gửi (vắng → giữ giá trị cũ). Gửi lên thì vẫn validate theo giới hạn.
 */
export const INACTIVE_SYSTEM_SETTINGS: Readonly<Partial<Record<SystemSettingKey, string>>> = Object.freeze({
  trialDays: "Chưa dùng — mô hình Free Forever, ADR-021.",
  refreshTokenTtlDays: "Không còn dùng — thay bằng chính sách phiên (thời hạn tối đa / \"Ghi nhớ đăng nhập\"), ADR-053.",
});

/**
 * ADR-053: ràng buộc chéo giữa các khoá phiên (mỗi khoá đã qua min/max riêng). Cảnh báo phải ngắn hơn idle nhỏ nhất,
 * idle không dài hơn thời hạn tối đa của chính nhóm đó. Trả lỗi theo khoá (rỗng = hợp lệ).
 */
export function validateSessionSettings(values: SystemSettingsValues): Partial<Record<SystemSettingKey, string>> {
  const errors: Partial<Record<SystemSettingKey, string>> = {};
  const minIdle = Math.min(values.sessionIdleMinutes, values.adminIdleMinutes);
  if (values.sessionWarningMinutes >= minIdle) {
    errors.sessionWarningMinutes = `Cảnh báo phải ngắn hơn thời gian tự đăng xuất (hiện nhỏ nhất ${minIdle} phút).`;
  }
  if (values.sessionIdleMinutes > values.sessionAbsoluteHours * 60) {
    errors.sessionIdleMinutes = "Thời gian tự đăng xuất không được dài hơn thời hạn tối đa một phiên.";
  }
  if (values.adminIdleMinutes > values.adminAbsoluteHours * 60) {
    errors.adminIdleMinutes = "Thời gian tự đăng xuất không được dài hơn thời hạn tối đa phiên quản trị viên.";
  }
  return errors;
}

export const DEFAULT_SYSTEM_SETTINGS: Readonly<SystemSettingsValues> = Object.freeze(
  Object.fromEntries(SYSTEM_SETTING_KEYS.map((key) => [key, SYSTEM_SETTINGS_BOUNDS[key].default])) as SystemSettingsValues,
);

function settingField(key: SystemSettingKey) {
  const bound: SystemSettingBound = SYSTEM_SETTINGS_BOUNDS[key];
  const range = `${bound.min}–${bound.max} ${bound.unit}`;
  return z.preprocess(
    // FormData gửi chuỗi: chuỗi rỗng = thiếu (không để z.coerce biến "" thành 0).
    (value) => (typeof value === "string" ? (value.trim() === "" ? undefined : Number(value.trim())) : value),
    z
      .number({ error: `${bound.label} phải là số nguyên (${range}).` })
      .int(`${bound.label} phải là số nguyên (${range}).`)
      .min(bound.min, `${bound.label} tối thiểu ${bound.min} ${bound.unit}.`)
      .max(bound.max, `${bound.label} tối đa ${bound.max} ${bound.unit}.`),
  );
}

/** Schema ghi — ngoài khoảng/không phải số nguyên → từ chối (ADR-032). Nhận cả số lẫn chuỗi (FormData). */
export const systemSettingsSchema = z.object(
  Object.fromEntries(SYSTEM_SETTING_KEYS.map((key) => [key, settingField(key)])) as Record<
    SystemSettingKey,
    ReturnType<typeof settingField>
  >,
);

export interface ParsedStoredSystemSettings {
  values: SystemSettingsValues;
  /** Khoá bị thay bằng mặc định vì thiếu/sai kiểu/ngoài khoảng — người gọi log warn. */
  invalidKeys: SystemSettingKey[];
  /** `true` khi chưa có dòng cấu hình nào (toàn bộ dùng mặc định). */
  missing: boolean;
}

/**
 * Parse phòng thủ dòng đọc từ DB: từng khoá hợp lệ thì giữ, thiếu/hỏng/ngoài
 * khoảng thì dùng mặc định của khoá đó — không bao giờ throw, không để một cột
 * sai làm hỏng cả cấu hình.
 */
export function parseStoredSystemSettings(row: Partial<Record<SystemSettingKey, unknown>> | null | undefined): ParsedStoredSystemSettings {
  if (!row) {
    return { values: { ...DEFAULT_SYSTEM_SETTINGS }, invalidKeys: [], missing: true };
  }
  const values = { ...DEFAULT_SYSTEM_SETTINGS };
  const invalidKeys: SystemSettingKey[] = [];
  for (const key of SYSTEM_SETTING_KEYS) {
    const raw = row[key];
    const bound: SystemSettingBound = SYSTEM_SETTINGS_BOUNDS[key];
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= bound.min && raw <= bound.max) {
      values[key] = raw;
    } else {
      invalidKeys.push(key);
    }
  }
  return { values, invalidKeys, missing: false };
}
