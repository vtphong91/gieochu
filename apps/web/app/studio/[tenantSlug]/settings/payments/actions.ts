"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { saveTenantProviderConfig, testTenantProviderConnection } from "../../../../../lib/tenant-payment";
import { readMomoManualForm } from "../../../../../lib/momo-manual-config";
import { isMissingEnumValueError, MOMO_MANUAL_NOT_READY_MESSAGE } from "../../../../../lib/db-errors";

export interface PaymentActionState {
  error?: string;
  success?: boolean;
  /** Thông báo kèm `success` (VD: hướng dẫn cấu hình SePay — ADR-065); không có thì form hiện "Đã lưu.". */
  message?: string;
  testResult?: { ok: boolean; message?: string };
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
  // ADR-065: 2–5 chữ cái (giới hạn ô "Tiền tố" của SePay); mã thanh toán của đơn = tiền tố + 8 chữ số.
  paymentPrefix: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2,5}$/, "Tiền tố mã thanh toán phải gồm 2–5 chữ cái (không dấu, không số).")),
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
  const apiToken = String(formData.get("apiToken") ?? "").trim();
  const { authType, paymentPrefix, ...publicConfig } = parsed.data;

  try {
    await saveTenantProviderConfig(tenant.id, {
      actorId: user.userId,
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
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  // ADR-065: nội dung chuyển khoản SePay là mã thanh toán riêng của đơn (tiền tố này + 8 chữ số) → nhắc khớp cấu hình bên SePay.
  // Hướng dẫn chi tiết nằm ở khối "Cấu hình bên SePay" của form (`sepaySetupSteps`).
  return { success: true, message: "Đã lưu. Nếu vừa đổi tiền tố, cập nhật Cấu trúc mã thanh toán bên SePay cho khớp." };
}

/** Kiểm tra kết nối SePay của gian hàng bằng cấu hình đã lưu — thành công tự bật cổng (chủ dự án chốt 2026-11-24). */
export async function testSepayConnectionAction(tenantSlug: string): Promise<PaymentActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const result = await testTenantProviderConnection(tenant.id, "SEPAY", user.userId);
  revalidatePath(`/studio/${tenantSlug}/settings/payments`);
  return { testResult: result };
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
