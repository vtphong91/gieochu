"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import type { PaymentProviderId } from "@gieochu/payments";
import { requireTenantMember } from "../../../../lib/tenant";
import { createRenewalInvoice } from "../../../../lib/subscription-billing";

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
