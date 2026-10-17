"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireVerified } from "../../../lib/session";
import { chooseFinalDownload, notifyRefundRequested, requestRefund } from "../../../lib/entitlement-remedy";

/**
 * ADR-039 — 2 lựa chọn của khách cho tài liệu bị gỡ do vi phạm. Mỗi action tự `requireVerified()` (không tin
 * trang/proxy); quyền sở hữu entitlement kiểm trong lib (đọc dưới `withCustomer`). Dùng với `useActionState` qua
 * `action.bind(null, entitlementId)` (tham số prevState/formData bị bỏ qua) → `{ ok }` hoặc `{ error, code }`.
 */
export interface RemedyActionState {
  ok?: boolean;
  error?: string;
  code?: string;
}

function toState(error: unknown): RemedyActionState {
  if (error instanceof AppError) return { error: error.message, code: error.code };
  throw error;
}

/** Lựa chọn A — tải lần cuối (mỗi tệp khả dụng 1 lượt, tối thiểu 1). Không đổi được sau khi chọn. */
export async function chooseFinalDownloadAction(entitlementId: string): Promise<RemedyActionState> {
  const user = await requireVerified();
  try {
    await chooseFinalDownload(user, entitlementId);
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/account/library");
  return { ok: true };
}

/** Lựa chọn B — yêu cầu hoàn tiền (chặn tải vĩnh viễn; chỉ đơn > 0đ). Email chủ gian hàng gửi sau response. */
export async function requestRefundAction(entitlementId: string): Promise<RemedyActionState> {
  const user = await requireVerified();
  try {
    const notification = await requestRefund(user, entitlementId);
    after(() => notifyRefundRequested(notification));
  } catch (error) {
    return toState(error);
  }
  revalidatePath("/account/library");
  return { ok: true };
}
