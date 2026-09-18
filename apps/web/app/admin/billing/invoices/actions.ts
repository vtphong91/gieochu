"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { confirmManualInvoicePayment } from "../../../../lib/subscription-billing";

export interface ConfirmInvoiceActionState {
  error?: string;
}

// useActionState calls this as (prevState, formData) after .bind(null, invoiceId) — neither
// is used here, and apps/web's Next.js eslint config (unlike packages/*'s baseConfig) has no
// argsIgnorePattern for `_`-prefixed args, so they're just omitted (TS allows a shorter param list).
export async function confirmManualInvoiceAction(invoiceId: string): Promise<ConfirmInvoiceActionState> {
  await requireRole("SYSTEM_ADMIN");
  try {
    await confirmManualInvoicePayment(invoiceId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/billing/invoices");
  return {};
}
