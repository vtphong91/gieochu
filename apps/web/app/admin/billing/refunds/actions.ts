"use server";

import { revalidatePath } from "next/cache";
import { AppError, type RefundPayoutDetails } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { approveRefundRequest, rejectRefundRequest, revealRefundPayout } from "../../../../lib/subscription-refund";

/**
 * ADR-041 B — System Center duyệt hoàn tiền gói. Mỗi action tự `requireRole("SYSTEM_ADMIN")`. Hoá đơn gói là L1
 * platform (§7.9 cho phép). Thông tin nhận tiền chỉ trả về khi admin bấm "Xem" (audit `SUBSCRIPTION_REFUND_PAYOUT_VIEWED` chỉ ghi id).
 */

export interface RefundDecisionActionState {
  error?: string;
  success?: boolean;
}

function toState(error: unknown): RefundDecisionActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

function revalidate(): void {
  revalidatePath("/admin/billing/refunds");
  revalidatePath("/admin/billing/invoices");
}

/** "Đã hoàn" — admin đã tự chuyển khoản; hoá đơn → REFUNDED, gian hàng về Free ngay. */
export async function approveRefundAction(requestId: string, _prev: RefundDecisionActionState, formData: FormData): Promise<RefundDecisionActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await approveRefundRequest(requestId, actor.userId, formData.get("adminNote"));
  } catch (error) {
    return toState(error);
  }
  revalidate();
  return { success: true };
}

/** Từ chối kèm lý do (bắt buộc, gửi cho chủ gian hàng). */
export async function rejectRefundAction(requestId: string, _prev: RefundDecisionActionState, formData: FormData): Promise<RefundDecisionActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await rejectRefundRequest(requestId, actor.userId, formData.get("reason"));
  } catch (error) {
    return toState(error);
  }
  revalidate();
  return { success: true };
}

export type RevealPayoutResult = { ok: true; payout: Omit<RefundPayoutDetails, "bankBin"> } | { ok: false; error: string };

/** Admin bấm "Xem thông tin nhận tiền" — chỉ yêu cầu đang chờ (đã xử lý thì dữ liệu đã bị xoá). */
export async function revealRefundPayoutAction(requestId: unknown): Promise<RevealPayoutResult> {
  const actor = await requireRole("SYSTEM_ADMIN");
  if (typeof requestId !== "string" || requestId.length === 0 || requestId.length > 64) return { ok: false, error: "Yêu cầu không hợp lệ." };
  try {
    const payout = await revealRefundPayout(requestId, actor.userId);
    return { ok: true, payout: { bankName: payout.bankName, accountNo: payout.accountNo, accountName: payout.accountName } };
  } catch (error) {
    if (error instanceof AppError && error.expose) return { ok: false, error: error.message };
    throw error;
  }
}
