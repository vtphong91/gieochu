"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import type { PaymentProviderId } from "@gieochu/payments";
import { requireTenantMember } from "../../../../lib/tenant";
import { createRenewalInvoice } from "../../../../lib/subscription-billing";
import { requestSubscriptionRefund } from "../../../../lib/subscription-refund";

export interface BillingActionState {
  error?: string;
}

const VALID_PROVIDERS: PaymentProviderId[] = ["MANUAL_QR", "SEPAY", "MOMO"];

export async function renewSubscriptionAction(
  tenantSlug: string,
  _prevState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);

  const provider = String(formData.get("provider") ?? "") as PaymentProviderId;
  if (!VALID_PROVIDERS.includes(provider)) {
    return { error: "Phương thức thanh toán không hợp lệ." };
  }
  const planId = String(formData.get("planId") ?? "").trim() || undefined;

  try {
    await createRenewalInvoice(tenant.id, { provider, planId });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/studio/${tenantSlug}/billing`);
  return {};
}

export interface RefundRequestActionState {
  error?: string;
  success?: boolean;
  fieldErrors?: Partial<Record<"bankBin" | "accountNo" | "accountName", string>>;
}

/**
 * ADR-041 B — chủ gian hàng (OWNER) gửi yêu cầu hoàn tiền gói. Điều kiện + số tiền tính lại ở server
 * (`requestSubscriptionRefund`): form chỉ gửi lý do + thông tin nhận tiền, không gửi id hoá đơn/số tiền.
 */
export async function requestSubscriptionRefundAction(
  tenantSlug: string,
  _prevState: RefundRequestActionState,
  formData: FormData,
): Promise<RefundRequestActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    const result = await requestSubscriptionRefund({
      tenantId: tenant.id,
      userId: user.userId,
      reason: formData.get("reason"),
      bankBin: formData.get("bankBin"),
      accountNo: formData.get("accountNo"),
      accountName: formData.get("accountName"),
    });
    if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  } catch (error) {
    if (error instanceof AppError && error.expose) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/billing`);
  return { success: true };
}
