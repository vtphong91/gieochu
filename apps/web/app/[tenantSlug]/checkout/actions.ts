"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { applyAuthCookiesTo } from "../../../lib/cookies";
import { getCurrentUser } from "../../../lib/session";
import { startGuestCheckout, type GuestCheckoutFieldErrors } from "../../../lib/guest-checkout";
import { clientIpFromHeaders } from "../../../lib/storefront-messages";

export interface GuestCheckoutActionState {
  error?: string;
  /** `EMAIL_EXISTS` | `EMAIL_EXISTS_GUEST` | `RATE_LIMITED` | `PRODUCT_UNAVAILABLE` | `VALIDATION` | `ALREADY_SIGNED_IN` (contract §6.2). */
  code?: string;
  fieldErrors?: GuestCheckoutFieldErrors;
  /** Giữ lại giá trị đã nhập khi lỗi (không bao giờ có mật khẩu — form này không có ô mật khẩu). */
  values?: { fullName: string; email: string; provider: string };
}

/**
 * ADR-061 Q1 / ADR-062 Q2 — `startGuestCheckoutAction`: khách CHƯA đăng nhập điền Họ tên + Email + ô đồng ý → tạo tài khoản
 * (PENDING, chưa có mật khẩu) + phiên khách vãng lai + đơn + thông tin thanh toán, rồi chuyển sang trang thanh toán của đơn.
 * Email kích hoạt + email đơn gửi sau response. Server Action → CSRF sẵn của Next.js (không cần kiểm Origin thủ công).
 */
export async function startGuestCheckoutAction(
  tenantSlug: string,
  productSlug: string,
  _prevState: GuestCheckoutActionState,
  formData: FormData,
): Promise<GuestCheckoutActionState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    provider: String(formData.get("provider") ?? ""),
  };
  if (await getCurrentUser()) {
    return { error: "Bạn đã đăng nhập — hãy bấm \"Mua ngay\" ở trang tài liệu.", code: "ALREADY_SIGNED_IN", values };
  }
  const headerStore = await headers();
  const result = await startGuestCheckout({
    tenantSlug,
    productSlug,
    fullName: values.fullName,
    email: values.email,
    acceptTerms: formData.get("acceptTerms") === "on",
    provider: values.provider,
    ip: clientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
    scheduleNotification: (task) => after(task),
  });
  if (!result.ok) return { error: result.error, code: result.code, fieldErrors: result.fieldErrors, values };

  applyAuthCookiesTo(await cookies(), result.cookies);
  redirect(`/${tenantSlug}/checkout/${result.orderCode}?vua-tao=1`);
}
