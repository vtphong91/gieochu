"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { savePlatformProviderConfig, testPlatformProviderConnection } from "../../../../lib/platform-payment";

export interface PlatformPaymentActionState {
  error?: string;
  success?: boolean;
  testResult?: { ok: boolean; message?: string };
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

  await savePlatformProviderConfig({
    actorId: actor.userId,
    provider: "MANUAL_QR",
    isEnabled: formData.get("isEnabled") === "on",
    publicConfig: parsed.data,
    secrets: {},
  });
  revalidatePath("/admin/billing/payment");
  return { success: true };
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

  try {
    await savePlatformProviderConfig({
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
  return { success: true };
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

  try {
    await savePlatformProviderConfig({
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
  return { success: true };
}

export async function testMomoConnectionAction(): Promise<PlatformPaymentActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const result = await testPlatformProviderConnection("MOMO", actor.userId);
  revalidatePath("/admin/billing/payment");
  return { testResult: result };
}
