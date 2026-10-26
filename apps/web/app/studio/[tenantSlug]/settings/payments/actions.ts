"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { saveTenantProviderConfig } from "../../../../../lib/tenant-payment";
import { readMomoManualForm } from "../../../../../lib/momo-manual-config";
import { isMissingEnumValueError, MOMO_MANUAL_NOT_READY_MESSAGE } from "../../../../../lib/db-errors";

export interface PaymentActionState {
  error?: string;
  success?: boolean;
  /** ADR-059 bổ sung lần 2 (c): cảnh báo kèm lưu thành công (vd tiền tố SePay khác tiền tố mã đơn). */
  warning?: string;
}

const manualQrSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4),
  accountName: z.string().min(1),
});

export async function saveManualQrAction(
  tenantSlug: string,
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const parsed = manualQrSchema.safeParse({
    bankBin: formData.get("bankBin"),
    accountNo: formData.get("accountNo"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  await saveTenantProviderConfig(tenant.id, {
    actorId: user.userId,
    provider: "MANUAL_QR",
    isEnabled: formData.get("isEnabled") === "on",
    publicConfig: parsed.data,
    secrets: {},
  });
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  return { success: true };
}

const sepaySchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4),
  accountName: z.string().min(1),
  authType: z.enum(["API_KEY", "HMAC_SHA256"]),
  paymentPrefix: z.string().min(1).max(4),
});

export async function saveSepayAction(
  tenantSlug: string,
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
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
    await saveTenantProviderConfig(tenant.id, {
      actorId: user.userId,
      provider: "SEPAY",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: { ...publicConfig, authType, paymentPrefix },
      secrets: { secret },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: "Thiếu secret/API key (bắt buộc khi lưu lần đầu)." };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  // ADR-059 bổ sung lần 2 (c): không khoá tiền tố, nhưng cảnh báo rõ khi lệch tiền tố mã đơn. Hệ thống vẫn tự khớp theo mã đơn
  // trong nội dung chuyển khoản; lệch chỉ ảnh hưởng việc SePay tự nhận diện "mã thanh toán" (vd tuỳ chọn bỏ qua giao dịch không có mã).
  if (paymentPrefix.trim().toUpperCase() !== tenant.orderCodePrefix.toUpperCase()) {
    return {
      success: true,
      warning: `Tiền tố "${paymentPrefix}" khác tiền tố mã đơn của gian hàng (${tenant.orderCodePrefix}). Mã đơn có dạng ${tenant.orderCodePrefix} + 6 ký tự — hãy đặt cấu trúc mã thanh toán bên SePay theo tiền tố ${tenant.orderCodePrefix}, nếu không SePay có thể không gửi hoặc không nhận diện giao dịch.`,
    };
  }
  return { success: true };
}

const momoSchema = z.object({
  partnerCode: z.string().min(1),
  accessKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

export async function saveMomoAction(
  tenantSlug: string,
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const parsed = momoSchema.safeParse({
    partnerCode: formData.get("partnerCode"),
    accessKey: formData.get("accessKey"),
    environment: formData.get("environment"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const secretKey = String(formData.get("secretKey") ?? "").trim();

  try {
    await saveTenantProviderConfig(tenant.id, {
      actorId: user.userId,
      provider: "MOMO",
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: {
        partnerCode: parsed.data.partnerCode,
        accessKey: parsed.data.accessKey,
        environment: parsed.data.environment,
      },
      secrets: { secretKey },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: "Thiếu secret key (bắt buộc khi lưu lần đầu)." };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  return { success: true };
}

/**
 * ADR-059 bổ sung lần 3 — "MoMo cá nhân (xác nhận tay)" của gian hàng (PaymentScope TENANT, `tenant_payment_configs` qua
 * `withTenant` trong `saveTenantProviderConfig`). Chỉ publicConfig, không secret.
 */
export async function saveMomoManualAction(
  tenantSlug: string,
  _prevState: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const parsed = readMomoManualForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  try {
    await saveTenantProviderConfig(tenant.id, {
      actorId: user.userId,
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
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  return { success: true };
}
