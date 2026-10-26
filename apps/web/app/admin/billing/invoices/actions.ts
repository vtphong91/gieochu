"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { confirmInvoiceFromPlatformTransaction, confirmManualInvoicePayment } from "../../../../lib/subscription-billing";

export interface ConfirmInvoiceActionState {
  error?: string;
}

// useActionState calls this as (prevState, formData) after .bind(null, invoiceId) — neither
// is used here, and apps/web's Next.js eslint config (unlike packages/*'s baseConfig) has no
// argsIgnorePattern for `_`-prefixed args, so they're just omitted (TS allows a shorter param list).
export async function confirmManualInvoiceAction(invoiceId: string): Promise<ConfirmInvoiceActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await confirmManualInvoicePayment(invoiceId, actor.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/billing/invoices");
  return {};
}

export interface ConfirmFromTransactionActionState {
  error?: string;
  success?: boolean;
}

/**
 * ADR-059 bổ sung lần 2 — xác nhận hoá đơn từ một giao dịch SePay cổng nền tảng. Form chỉ gửi mã hoá đơn admin chọn; số tiền,
 * trạng thái, thiếu/thừa, "giao dịch đã dùng" đều kiểm lại ở server dưới khoá.
 */
export async function confirmInvoiceFromTransactionAction(
  transactionId: string,
  _prevState: ConfirmFromTransactionActionState,
  formData: FormData,
): Promise<ConfirmFromTransactionActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await confirmInvoiceFromPlatformTransaction(transactionId, String(formData.get("invoiceCode") ?? ""), actor.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/billing/invoices");
  return { success: true };
}
