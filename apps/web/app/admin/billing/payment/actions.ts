"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { getPlatformPaymentConfigRow, savePlatformProviderConfig, testPlatformProviderConnection } from "../../../../lib/platform-payment";
import { DEFAULT_INVOICE_CODE_PREFIX, normalizeInvoiceCodePrefix } from "../../../../lib/subscription-billing";
import { readMomoManualForm } from "../../../../lib/momo-manual-config";
import { isMissingEnumValueError, MOMO_MANUAL_NOT_READY_MESSAGE } from "../../../../lib/db-errors";

export interface PlatformPaymentActionState {
  error?: string;
  success?: boolean;
  /** Thông báo kèm `success` (VD: ADR-013 tự tắt) — không có thì form hiện "Đã lưu.". */
  message?: string;
  testResult?: { ok: boolean; message?: string };
}

// ADR-013: lần lưu đầu / đổi tài khoản-secret thì cổng bị tự tắt dù admin đã bật — nói rõ để admin lưu lại lần nữa.
const AUTO_DISABLED_MESSAGE =
  "Đã lưu. Phương thức đang tắt vì thông tin tài khoản vừa thay đổi — bật lại và bấm Lưu thêm một lần để xác nhận.";

function savedState(result: { autoDisabled: boolean }): PlatformPaymentActionState {
  return result.autoDisabled ? { success: true, message: AUTO_DISABLED_MESSAGE } : { success: true };
}

const manualQrSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4),
  accountName: z.string().min(1),
});

export async function saveManualQrAction(
  _prevState: PlatformPaymentActionState,
  formData: FormData,
): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const parsed = manualQrSchema.safeParse({
    bankBin: formData.get("bankBin"),
    accountNo: formData.get("accountNo"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const result = await savePlatformProviderConfig({
    actorId: actor.userId,
    provider: "MANUAL_QR",
    isEnabled: formData.get("isEnabled") === "on",
    publicConfig: parsed.data,
    secrets: {},
  });
  revalidatePath("/admin/billing/payment");
  return savedState(result);
}

const sepaySchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4),
  accountName: z.string().min(1),
  authType: z.enum(["API_KEY", "HMAC_SHA256"]),
  // ADR-065: 2–5 chữ cái (giới hạn ô "Tiền tố" của SePay); mã hoá đơn = tiền tố + 8 chữ số.
  paymentPrefix: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2,5}$/, "Tiền tố mã hoá đơn phải gồm 2–5 chữ cái (không dấu, không số).")),
});

export async function saveSepayAction(
  _prevState: PlatformPaymentActionState,
  formData: FormData,
): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const parsed = sepaySchema.safeParse({
    bankBin: formData.get("bankBin"),
    accountNo: formData.get("accountNo"),
    accountName: formData.get("accountName"),
    authType: formData.get("authType"),
    paymentPrefix: formData.get("paymentPrefix"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const secret = String(formData.get("secret") ?? "").trim();
  const apiToken = String(formData.get("apiToken") ?? "").trim();
  const { authType, paymentPrefix, ...publicConfig } = parsed.data;

  const previousPrefix = normalizeInvoiceCodePrefix(((await getPlatformPaymentConfigRow("SEPAY"))?.publicConfig as Record<string, unknown> | undefined)?.paymentPrefix);
  let result: { autoDisabled: boolean };
  try {
    result = await savePlatformProviderConfig({
      actorId: actor.userId,
      provider: "SEPAY",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: { ...publicConfig, authType, paymentPrefix },
      // `apiToken` để trống = giữ token đã lưu (chỉ dùng cho "Kiểm tra kết nối", không bắt buộc).
      secrets: { secret, apiToken },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: "Thiếu secret/API key (bắt buộc khi lưu lần đầu)." };
    throw error;
  }
  revalidatePath("/admin/billing/payment");
  return withPrefixWarning(savedState(result), paymentPrefix, previousPrefix);
}

/** Kiểm tra kết nối SePay bằng cấu hình đã lưu (User API + API Token) — thành công tự bật cổng (ADR-013, như MoMo). */
export async function testSepayConnectionAction(): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const result = await testPlatformProviderConnection("SEPAY", actor.userId);
  revalidatePath("/admin/billing/payment");
  return { testResult: result };
}

/**
 * ADR-059 bổ sung lần 2 (c) + ADR-065: nhắc đúng cấu hình "Cấu trúc mã thanh toán" bên SePay sau mỗi lần lưu; đổi tiền tố → hoá
 * đơn đang chờ tạo với tiền tố cũ (khác SUB) không còn tự khớp.
 */
function withPrefixWarning(state: PlatformPaymentActionState, prefix: string, previousPrefix: string | null): PlatformPaymentActionState {
  const warnings = [`Mã hoá đơn SePay mới có dạng ${prefix} + 8 chữ số — Cấu trúc mã thanh toán bên SePay phải cùng tiền tố.`];
  if (previousPrefix && previousPrefix !== prefix && previousPrefix !== DEFAULT_INVOICE_CODE_PREFIX) {
    warnings.push(`Hoá đơn đang chờ tạo với tiền tố cũ ${previousPrefix} sẽ không tự khớp nữa — kiểm tra ở tab "Giao dịch cổng".`);
  }
  const base = state.message ?? "Đã lưu.";
  return { ...state, message: `${base} ${warnings.join(" ")}` };
}

const momoSchema = z.object({
  partnerCode: z.string().min(1),
  accessKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

export async function saveMomoAction(
  _prevState: PlatformPaymentActionState,
  formData: FormData,
): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const parsed = momoSchema.safeParse({
    partnerCode: formData.get("partnerCode"),
    accessKey: formData.get("accessKey"),
    environment: formData.get("environment"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const secretKey = String(formData.get("secretKey") ?? "").trim();

  let result: { autoDisabled: boolean };
  try {
    result = await savePlatformProviderConfig({
      actorId: actor.userId,
      provider: "MOMO",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: parsed.data,
      secrets: { secretKey },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: "Thiếu secret key (bắt buộc khi lưu lần đầu)." };
    throw error;
  }
  revalidatePath("/admin/billing/payment");
  return savedState(result);
}

export async function testMomoConnectionAction(): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const result = await testPlatformProviderConnection("MOMO", actor.userId);
  revalidatePath("/admin/billing/payment");
  return { testResult: result };
}

/** ADR-059 bổ sung lần 3 — "MoMo cá nhân (xác nhận tay)" của nền tảng (PaymentScope PLATFORM, thu phí gói). Không secret. */
export async function saveMomoManualAction(
  _prevState: PlatformPaymentActionState,
  formData: FormData,
): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const parsed = readMomoManualForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  let result: { autoDisabled: boolean };
  try {
    result = await savePlatformProviderConfig({
      actorId: actor.userId,
      provider: "MOMO_MANUAL",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: parsed.config,
      secrets: {},
    });
  } catch (error) {
    if (isMissingEnumValueError(error)) return { error: MOMO_MANUAL_NOT_READY_MESSAGE };
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/billing/payment");
  return savedState(result);
}
