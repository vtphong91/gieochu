"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { confirmInvoiceFromPlatformTransaction, confirmManualInvoicePayment } from "../../../../lib/subscription-billing";

export interface ConfirmInvoiceActionState {
  error?: string;
  success?: boolean;
}

/**
 * ADR-066 — admin xác nhận tay hoá đơn gói đã nhận tiền (mọi cổng), ghi chú không bắt buộc (ghi vào audit). Trạng thái hoá đơn,
 * luật hoá đơn hết hạn (chặn khi có hoá đơn mới hơn, tính lại kỳ) đều kiểm ở server dưới khoá. Dùng ở /admin/billing/invoices và
 * /admin/subscriptions.
 */
export async function confirmManualInvoiceAction(
  invoiceId: string,
  _prevState: ConfirmInvoiceActionState,
  formData: FormData,
): Promise<ConfirmInvoiceActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await confirmManualInvoicePayment(invoiceId, actor.userId, String(formData.get("note") ?? ""));
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/billing/invoices");
  revalidatePath("/admin/subscriptions");
  return { success: true };
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
  revalidatePath("/admin/subscriptions");
  return { success: true };
}
