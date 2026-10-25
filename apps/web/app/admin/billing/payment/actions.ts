"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { savePlatformProviderConfig, testPlatformProviderConnection } from "../../../../lib/platform-payment";

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
  paymentPrefix: z.string().min(2).max(6),
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
  const { authType, paymentPrefix, ...publicConfig } = parsed.data;

  let result: { autoDisabled: boolean };
  try {
    result = await savePlatformProviderConfig({
      actorId: actor.userId,
      provider: "SEPAY",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: { ...publicConfig, authType, paymentPrefix: paymentPrefix.toUpperCase() },
      secrets: { secret },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: "Thiếu secret/API key (bắt buộc khi lưu lần đầu)." };
    throw error;
  }
  revalidatePath("/admin/billing/payment");
  return savedState(result);
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
