import { cache } from "react";
import {
  AppError,
  ErrorCodes,
  INACTIVE_SYSTEM_SETTINGS,
  logger,
  parseStoredSystemSettings,
  SYSTEM_SETTING_KEYS,
  SYSTEM_SETTINGS_BOUNDS,
  systemSettingsSchema,
  validateSessionSettings,
  type SystemSettingKey,
  type SystemSettingsValues,
} from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import type { CurrentUser } from "./session";
import { audit } from "./audit";

/**
 * ADR-032 mục 3 — cấu hình hệ thống (bảng L1 `system_settings`, 1 dòng). Mặc định + giới hạn ở
 * `@gieochu/core` (`SYSTEM_SETTINGS_BOUNDS`). Mọi nơi trước đây đọc env TTL/trial/grace... gọi hàm này
 * rồi truyền giá trị xuống package thuần (auth/storage/core không đọc DB).
 */

const CONFIG_ID = "default";

let warnedMissingRow = false;

async function loadSystemSettings(): Promise<SystemSettingsValues> {
  const row = await getPrismaClient().systemSettings.findUnique({ where: { id: CONFIG_ID } });
  const parsed = parseStoredSystemSettings(row);
  if (parsed.missing) {
    if (!warnedMissingRow) {
      warnedMissingRow = true;
      logger.warn("system_settings: chưa có dòng cấu hình — dùng giá trị mặc định (ADR-032)");
    }
  } else if (parsed.invalidKeys.length > 0) {
    logger.warn({ invalidKeys: parsed.invalidKeys }, "system_settings: giá trị thiếu/ngoài giới hạn — dùng mặc định cho các khoá này");
  }
  return parsed.values;
}

/**
 * ADR-059: địa chỉ "Email hỗ trợ" (`system_settings.supportEmail`, form /admin/settings) — đọc động lúc gửi (không cache,
 * admin đổi có hiệu lực ngay). Trống / chưa có dòng / lỗi đọc → `null` (người gọi bỏ qua gửi, chỉ log).
 */
export async function getSupportEmail(): Promise<string | null> {
  try {
    const row = await getPrismaClient().systemSettings.findUnique({ where: { id: CONFIG_ID }, select: { supportEmail: true } });
    return row?.supportEmail?.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, "system_settings: không đọc được email hỗ trợ");
    return null;
  }
}

/**
 * Cấu hình hiệu lực. Trong request (RSC/Route Handler/Server Action) `cache()` dedupe theo request;
 * ngoài React (worker pg-boss, script) `cache()` là passthrough → mỗi lần gọi đọc lại DB, nên worker
 * gọi hàm này mỗi lần chạy job để nhận thay đổi mới mà không cần khởi động lại.
 */
export const getSystemSettings = cache(loadSystemSettings);

export interface SystemSettingsPageData {
  /** Giá trị hiệu lực (đã parse phòng thủ). */
  values: SystemSettingsValues;
  /** Mặc định + giới hạn + nhãn + đơn vị theo khoá (cũng import được ở client qua `@gieochu/core/system-settings`). */
  bounds: typeof SYSTEM_SETTINGS_BOUNDS;
  /** Khoá đang lưu sai/ngoài khoảng trong DB (đang dùng mặc định) — UI nên cảnh báo. */
  invalidKeys: SystemSettingKey[];
  /** Khoá chưa có nghiệp vụ dùng (hiện: `trialDays`) — UI ẩn; action không bắt buộc gửi. */
  inactiveKeys: SystemSettingKey[];
  /** Lý do theo khoá inactive, vd `{ trialDays: "Chưa dùng — mô hình Free Forever, ADR-021." }`. */
  inactiveReasons: Partial<Record<SystemSettingKey, string>>;
  /** `true` khi chưa có dòng cấu hình (mọi giá trị là mặc định). */
  isDefault: boolean;
  updatedAt: Date | null;
  updatedByEmail: string | null;
}

/** Loader cho trang `/admin/settings/general` — người gọi đã `requireAdminAccess()`. Không cache. */
export async function getSystemSettingsPageData(): Promise<SystemSettingsPageData> {
  const prisma = getPrismaClient();
  const row = await prisma.systemSettings.findUnique({ where: { id: CONFIG_ID } });
  const parsed = parseStoredSystemSettings(row);
  const updatedBy = row?.updatedById
    ? await prisma.user.findUnique({ where: { id: row.updatedById }, select: { email: true } })
    : null;
  return {
    values: parsed.values,
    bounds: SYSTEM_SETTINGS_BOUNDS,
    invalidKeys: parsed.invalidKeys,
    inactiveKeys: SYSTEM_SETTING_KEYS.filter((key) => key in INACTIVE_SYSTEM_SETTINGS),
    inactiveReasons: { ...INACTIVE_SYSTEM_SETTINGS },
    isDefault: parsed.missing,
    updatedAt: row?.updatedAt ?? null,
    updatedByEmail: updatedBy?.email ?? null,
  };
}

export type SystemSettingsFieldErrors = Partial<Record<SystemSettingKey, string>>;

export interface SystemSettingsActionState {
  ok: boolean;
  /** Thông báo tổng (tiếng Việt) khi `ok=false`. */
  error?: string;
  /** `VALIDATION_ERROR` | `UNAUTHORIZED` | `FORBIDDEN` | `INTERNAL_ERROR`. */
  code?: string;
  /** Lỗi theo từng field (tên field = khoá `SystemSettingKey`). */
  fieldErrors?: SystemSettingsFieldErrors;
  /** Giá trị đã lưu (khi `ok=true`). */
  values?: SystemSettingsValues;
}

/**
 * Validate (zod, ngoài khoảng → từ chối cả form) rồi ghi mọi khoá cấu hình, log thay đổi cũ→mới. Người gọi
 * (Server Action) đã `requireRole("SYSTEM_ADMIN")`. Chỉ ghi các khoá cấu hình — không đụng
 * `supportEmail` (form /admin/settings).
 */
export async function saveSystemSettings(actor: CurrentUser, formData: FormData): Promise<SystemSettingsActionState> {
  const previous = await loadSystemSettings();
  // Khoá inactive (UI ẩn) vắng mặt trong form → giữ giá trị cũ; khoá khác vắng → lỗi "bắt buộc".
  const raw = Object.fromEntries(
    SYSTEM_SETTING_KEYS.map((key) => {
      const value = formData.get(key);
      if (value === null && key in INACTIVE_SYSTEM_SETTINGS) return [key, previous[key]];
      return [key, value ?? undefined];
    }),
  );
  const parsed = systemSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: SystemSettingsFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as SystemSettingKey | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, code: ErrorCodes.VALIDATION_ERROR, error: "Có giá trị không hợp lệ, vui lòng kiểm tra lại.", fieldErrors };
  }

  const next = parsed.data as SystemSettingsValues;
  // ADR-053: ràng buộc chéo của chính sách phiên (cảnh báo < idle, idle ≤ thời hạn tối đa).
  const sessionErrors = validateSessionSettings(next);
  if (Object.keys(sessionErrors).length > 0) {
    return { ok: false, code: ErrorCodes.VALIDATION_ERROR, error: "Có giá trị không hợp lệ, vui lòng kiểm tra lại.", fieldErrors: sessionErrors };
  }
  await getPrismaClient().systemSettings.upsert({
    where: { id: CONFIG_ID },
    update: { ...next, updatedById: actor.userId },
    create: { id: CONFIG_ID, ...next, updatedById: actor.userId },
  });

  const changes = Object.fromEntries(
    SYSTEM_SETTING_KEYS.filter((key) => previous[key] !== next[key]).map((key) => [key, { from: previous[key], to: next[key] }]),
  );
  logger.info({ actorId: actor.userId, changes }, "system_settings: cập nhật cấu hình hệ thống");
  // ADR-032 mục 3 / ADR-037: các khoá cấu hình đều là số (TTL, ngày...) — ghi cũ→mới, không có secret.
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "SYSTEM_SETTINGS_UPDATED",
    targetType: "SystemSettings",
    targetId: CONFIG_ID,
    metadata: { form: "general", changes },
  });

  return { ok: true, values: next };
}

/** Chuyển lỗi quyền (AppError) thành state trả về form thay vì ném ra error boundary. */
export function systemSettingsErrorState(error: unknown): SystemSettingsActionState {
  if (error instanceof AppError && error.expose) {
    return { ok: false, code: error.code, error: error.message };
  }
  logger.error({ err: error }, "system_settings: lưu cấu hình thất bại");
  return { ok: false, code: ErrorCodes.INTERNAL_ERROR, error: "Không lưu được cấu hình, vui lòng thử lại." };
}
