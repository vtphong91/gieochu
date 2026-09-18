"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { saveTenantProviderConfig } from "../../../../../lib/tenant-payment";

export interface PaymentActionState {
  error?: string;
  success?: boolean;
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
  const { tenant } = await requireTenantMember(tenantSlug);
  const parsed = manualQrSchema.safeParse({
    bankBin: formData.get("bankBin"),
    accountNo: formData.get("accountNo"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  await saveTenantProviderConfig(tenant.id, {
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
  const { tenant } = await requireTenantMember(tenantSlug);
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
  const { tenant } = await requireTenantMember(tenantSlug);
  const parsed = momoSchema.safeParse({
    partnerCode: formData.get("partnerCode"),
    accessKey: formData.get("accessKey"),
    environment: formData.get("environment"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const secretKey = String(formData.get("secretKey") ?? "").trim();

  try {
    await saveTenantProviderConfig(tenant.id, {
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
